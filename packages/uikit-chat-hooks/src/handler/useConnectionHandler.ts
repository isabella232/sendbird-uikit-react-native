import React, { useEffect } from 'react';
import type Sendbird from 'sendbird';

import { Logger, SendbirdChatSDK } from '@sendbird/uikit-utils';

export const useConnectionHandler = (
  sdk: SendbirdChatSDK,
  handlerId: string,
  hookHandler: Partial<Sendbird.ConnectionHandler>,
  deps: React.DependencyList = [],
) => {
  useEffect(() => {
    Logger.info('[useConnectionHandler]', handlerId);

    const handler = new sdk.ConnectionHandler();
    const handlerKeys = Object.keys(handler) as (keyof typeof handler)[];
    handlerKeys.forEach((key) => {
      const hookHandlerFn = hookHandler[key];
      if (hookHandlerFn) handler[key] = hookHandlerFn;
    });

    sdk.addConnectionHandler(handlerId, handler);
    return () => sdk.removeConnectionHandler(handlerId);
  }, [sdk, handlerId, ...deps]);
};
