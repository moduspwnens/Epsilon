import { AuthResponse, AuthResponseContext, Callback, Context, CustomAuthorizerEvent, PolicyDocument } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { LocalWebTokenManipulator } from './local-web-token-manipulator';
import { EpsilonConstants } from '../../epsilon-constants';

/**
 * This class is to simplify if the user wants to use a AWS Gateway authorizer in conjunction with Epsilon
 */
export class ApiGatewayAdapterAuthenticationHandler {
  private webTokenManipulator: LocalWebTokenManipulator;

  constructor(issuer: string, encryptionKeys: string) {
    this.webTokenManipulator = new LocalWebTokenManipulator([encryptionKeys], issuer);
  }

  /**
   * This is the default authorizer - parses the incoming JWT token and sticks it
   * into context (or blocks if none/invalid found)
   * @param event
   * @param {Context} context
   * @param {Callback} callback
   */
  public lambdaHandler(event: CustomAuthorizerEvent, context: Context, callback: Callback): void {
    Logger.info('Got event : %j', event);

    const srcString = ApiGatewayAdapterAuthenticationHandler.extractTokenStringFromAuthorizerEvent(event);

    if (srcString) {
      const methodArn = event.methodArn;

      const parsed: CommonJwtToken<any> = this.webTokenManipulator.parseAndValidateJWTString(srcString);

      if (parsed) {
        callback(null, this.createPolicy(methodArn, srcString, parsed));
      } else {
        Logger.info('Invalid bearer token');
        callback(new Error('Unauthorized')); // Required by Lambda
      }
    } else {
      Logger.info('Token not supplied');
      callback(new Error('Unauthorized')); // Required by Lambda
    }
  }

  private createPolicy(methodArn: string, srcString: string, userOb: any): AuthResponse {
    // If we reached here, create a policy document
    // parse the ARN from the incoming event
    const tmp = methodArn.split(':'); // event.methodArn;
    const apiGatewayArnTmp = tmp[5].split('/');
    const awsAccountId = tmp[4];
    const region = tmp[3];
    const stage = apiGatewayArnTmp[1];
    const restApiId = apiGatewayArnTmp[0];

    const response: AuthResponse = {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: ['arn:aws:execute-api:' + region + ':' + awsAccountId + ':' + restApiId + '/' + stage + '/*/*'],
          },
        ],
      } as PolicyDocument,
      // Context matches what would come in ExtendedAuthResponseContext if using epsilon auth
      context: {
        userJSON: JSON.stringify(userOb),
        srcData: srcString, // Put this in in-case we are doing a token update
      } as AuthResponseContext,
    } as AuthResponse;

    return response;
  }

  public static extractTokenStringFromAuthorizerEvent(event: CustomAuthorizerEvent): string {
    Logger.silly('Extracting token from event : %j', event);
    let rval: string = null;
    if (event && event.authorizationToken) {
      const token: string = event.authorizationToken;
      if (token && token.startsWith(EpsilonConstants.AUTH_HEADER_PREFIX)) {
        rval = token.substring(EpsilonConstants.AUTH_HEADER_PREFIX.length); // Strip "Bearer "
      }
    }
    return rval;
  }
}
