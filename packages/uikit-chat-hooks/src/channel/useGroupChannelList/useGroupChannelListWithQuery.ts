import { useRef } from 'react';
import type Sendbird from 'sendbird';

import type { SendbirdChannel, SendbirdChatSDK } from '@sendbird/uikit-utils';
import { useAsyncEffect, useFreshCallback } from '@sendbird/uikit-utils';

import { useAppFeatures } from '../../common/useAppFeatures';
import { useChannelHandler } from '../../handler/useChannelHandler';
import type { UseGroupChannelList, UseGroupChannelListOptions } from '../../types';
import { useGroupChannelListReducer } from './reducer';

const HOOK_NAME = 'useGroupChannelListWithQuery';

const createGroupChannelListQuery = (
  sdk: SendbirdChatSDK,
  queryCreator: UseGroupChannelListOptions['queryCreator'],
) => {
  const passedQuery = queryCreator?.();
  if (passedQuery) return passedQuery;

  const defaultOptions = {
    includeEmpty: false,
    limit: 20,
    order: 'latest_last_message',
  } as const;
  const defaultQuery = sdk.GroupChannel.createMyGroupChannelListQuery();
  defaultQuery.limit = defaultOptions.limit;
  defaultQuery.order = defaultOptions.order;
  defaultQuery.includeEmpty = defaultOptions.includeEmpty;
  return defaultQuery;
};

export const useGroupChannelListWithQuery: UseGroupChannelList = (sdk, userId, options) => {
  const { deliveryReceiptEnabled } = useAppFeatures(sdk);
  const queryRef = useRef<Sendbird.GroupChannelListQuery>();

  const {
    loading,
    groupChannels,
    refreshing,
    updateChannels,
    setChannels,
    deleteChannels,
    updateRefreshing,
    updateLoading,
    updateOrder,
  } = useGroupChannelListReducer();

  const updateChannelsAndMarkAsDelivered = (channels: SendbirdChannel[]) => {
    updateChannels(channels);
    if (deliveryReceiptEnabled) channels.forEach((channel) => sdk.markAsDelivered(channel.url));
  };

  const init = useFreshCallback(async (uid?: string) => {
    if (uid) {
      queryRef.current = createGroupChannelListQuery(sdk, options?.queryCreator);
      updateOrder(queryRef.current?.order);

      if (queryRef.current?.hasNext) {
        const channels = await queryRef.current.next();

        setChannels(channels, true);
        if (deliveryReceiptEnabled) channels.forEach((channel) => sdk.markAsDelivered(channel.url));
      }
    }
  });

  useAsyncEffect(async () => {
    updateLoading(true);
    await init(userId);
    updateLoading(false);
  }, [init, userId]);

  useChannelHandler(sdk, HOOK_NAME, {
    onChannelChanged: (channel) => updateChannelsAndMarkAsDelivered([channel]),
    onChannelFrozen: (channel) => updateChannels([channel]),
    onChannelUnfrozen: (channel) => updateChannels([channel]),
    onChannelMemberCountChanged: (channels) => updateChannels(channels),
    onChannelDeleted: (url) => deleteChannels([url]),
    onUserJoined: (channel) => updateChannelsAndMarkAsDelivered([channel]),
    onUserLeft: (channel, user) => {
      const isMe = user.userId === userId;
      if (isMe) deleteChannels([channel.url]);
      else updateChannelsAndMarkAsDelivered([channel]);
    },
    onUserBanned(channel, user) {
      const isMe = user.userId === userId;
      if (isMe) deleteChannels([channel.url]);
      else updateChannelsAndMarkAsDelivered([channel]);
    },
  });

  const refresh = useFreshCallback(async () => {
    updateRefreshing(true);
    await init(userId);
    updateRefreshing(false);
  });

  const next = useFreshCallback(async () => {
    if (queryRef.current?.hasNext) {
      const channels = await queryRef.current.next();
      setChannels(channels, false);
      if (deliveryReceiptEnabled) channels.forEach((channel) => sdk.markAsDelivered(channel.url));
    }
  });

  return {
    loading,
    groupChannels,
    refresh,
    refreshing,
    next,
  };
};
