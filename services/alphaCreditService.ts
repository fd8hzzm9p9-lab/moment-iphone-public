import AsyncStorage
  from '@react-native-async-storage/async-storage';

import {
  SERVER_URL,
} from '../config/server';

import {
  getMomentDeviceId,
} from './diagnosticService';

const CREDIT_REQUEST_CACHE_KEY =
  'moment_alpha_credit_request_v1';

const CREDIT_SNAPSHOT_KEY =
  'moment_alpha_credit_snapshot_v1';

export type AlphaCreditRequest = {
  request_code:
    string;

  status:
    string;

  created_at?:
    string;

  updated_at?:
    string;
};

export type AlphaCreditQuotaSnapshot = {
  synced_at?:
    string;

  initial_quota?:
    number;

  credits_granted?:
    number;

  credits_used?:
    number;

  credits_remaining?:
    number;

  recharge_count?:
    number;

  total_recharged?:
    number;

  usage?: {
    request_count?:
      number;

    input_tokens?:
      number;

    output_tokens?:
      number;

    total_tokens?:
      number;

    understand_requests?:
      number;

    recall_requests?:
      number;
  };
};

export type AlphaCreditStatus = {
  credit_needed?:
    boolean;

  pending:
    boolean;

  request:
    AlphaCreditRequest |
    null;

  quota_snapshot?:
    AlphaCreditQuotaSnapshot |
    null;
};

async function post(
  endpoint:
    string,

  payload:
    Record<
      string,
      unknown
    >
) {
  const response =
    await fetch(
      `${SERVER_URL}${endpoint}`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error ||
      'Serveur Moment indisponible.'
    );
  }

  return data;
}

async function cacheRequest(
  request:
    AlphaCreditRequest |
    null
) {
  if (
    request &&
    request.request_code &&
    request.status ===
      'pending'
  ) {
    await AsyncStorage
      .setItem(
        CREDIT_REQUEST_CACHE_KEY,
        JSON.stringify(
          request
        )
      );

  } else {
    await AsyncStorage
      .removeItem(
        CREDIT_REQUEST_CACHE_KEY
      );
  }
}

async function cacheQuotaSnapshot(
  snapshot:
    AlphaCreditQuotaSnapshot |
    null |
    undefined
) {
  if (
    !snapshot
  ) {
    return;
  }

  await AsyncStorage
    .setItem(
      CREDIT_SNAPSHOT_KEY,
      JSON.stringify({
        ...snapshot,

        stored_on_device_at:
          new Date()
            .toISOString(),
      })
    );
}

export async function getCachedAlphaCreditRequest():
  Promise<
    AlphaCreditRequest |
    null
  > {
  try {
    const raw =
      await AsyncStorage
        .getItem(
          CREDIT_REQUEST_CACHE_KEY
        );

    return raw
      ? JSON.parse(
          raw
        )
      : null;

  } catch {
    return null;
  }
}

export async function getLocalAlphaCreditSnapshot() {
  try {
    const raw =
      await AsyncStorage
        .getItem(
          CREDIT_SNAPSHOT_KEY
        );

    if (!raw) {
      return {
        available:
          false,

        source:
          'device_cache',

        reason:
          'no_snapshot_yet',
      };
    }

    return {
      available:
        true,

      source:
        'device_cache',

      ...JSON.parse(
        raw
      ),
    };

  } catch (
    error
  ) {
    return {
      available:
        false,

      source:
        'device_cache',

      error:
        String(
          error
        ),
    };
  }
}

export async function getAlphaCreditStatus():
  Promise<
    AlphaCreditStatus
  > {
  const deviceId =
    await getMomentDeviceId();

  const result =
    await post(
      '/alpha-credit/status',
      {
        moment_device_id:
          deviceId,
      }
    );

  await cacheRequest(
    result.request ||
    null
  );

  await cacheQuotaSnapshot(
    result.quota_snapshot
  );

  return result;
}

export async function requestAlphaCredits():
  Promise<
    AlphaCreditStatus
  > {
  const deviceId =
    await getMomentDeviceId();

  const result =
    await post(
      '/alpha-credit/request',
      {
        moment_device_id:
          deviceId,
      }
    );

  /*
   * On relit immédiatement le statut
   * pour synchroniser le téléphone.
   */
  const status =
    await getAlphaCreditStatus();

  await cacheRequest(
    status.request ||
    result.request ||
    null
  );

  return status;
}

export async function redeemAlphaCredits(
  rechargeCode:
    string
) {
  const deviceId =
    await getMomentDeviceId();

  const result =
    await post(
      '/alpha-credit/redeem',
      {
        moment_device_id:
          deviceId,

        recharge_code:
          rechargeCode
            .trim()
            .toUpperCase(),
      }
    );

  await AsyncStorage
    .removeItem(
      CREDIT_REQUEST_CACHE_KEY
    );

  /*
   * Synchronisation immédiate après recharge.
   */
  await getAlphaCreditStatus();

  return result;
}
