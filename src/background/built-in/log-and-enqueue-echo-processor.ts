import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';
import { EchoProcessor } from './echo-processor';

export class LogAndEnqueueEchoProcessor implements BackgroundProcessor<any, any> {
  public get typeName(): string {
    return 'BackgroundBuiltInLogAndEnqueueEchoProcessor';
  }

  public async handleEvent(data: any, metaData: any, cfg: BackgroundManager): Promise<void> {
    Logger.info('LogAndEnqueueEchoProcessor : %j', data);
    await cfg.fireImmediateProcessRequestByParts(EchoProcessor.TYPE_NAME, { upstream: data });
    Logger.info('Completed : LogAndEnqueueEchoProcessor');
  }
}
