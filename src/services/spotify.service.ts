import axios, { AxiosError, AxiosInstance } from 'axios';
import * as querystring from 'node:querystring';
import open from 'open';
import {
  CLI_SERVER_ADDRESS_CALLBACK,
  getUserCredentials,
  SPOTIFY_SERVER_ADDRESS,
} from '../utils';

type GetDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

type GetTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  'not-before-policy': number;
  session_state: string;
  scope: string;
};

type GetUserInfoResponse = {
  sub: string;
  email_verified: boolean;
  name: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
};

export enum ToFromEnum {
  to = 'to',
  from = 'from',
}

export class SpotifyService {
  http: AxiosInstance;
  clientId: string;

  constructor() {
    this.http = axios.create();

    this.clientId = 'd64ca1f7e091459494fbeef881a6273e';
  }

  // async getDeviceCode(): Promise<GetDeviceCodeResponse> {
  //   const { data } = await this.http.post(
  //     '/auth/device',
  //     {
  //       client_id: this.clientId,
  //     },
  //     {
  //       headers: {
  //         'Content-Type': 'application/x-www-form-urlencoded',
  //       },
  //     }
  //   );
  //   return data;
  // }

  // async poolToken(
  //   deviceCode: string,
  //   interval: number
  // ): Promise<GetTokenResponse> {
  //   let response: GetTokenResponse | null = null;
  //   try {
  //     const { data } = await this.http.post<GetTokenResponse>(
  //       '/token',
  //       {
  //         client_id: this.clientId,
  //         device_code: deviceCode,
  //         grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  //       },
  //       {
  //         headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded',
  //         },
  //       }
  //     );
  //     response = data;
  //   } catch (error) {
  //     if (error instanceof AxiosError) {
  //       const { error: err } = error.response?.data;

  //       if (err === 'authorization_pending' && response == null) {
  //         response = await new Promise((resolve) => {
  //           setTimeout(async () => {
  //             resolve(await this.poolToken(deviceCode, interval));
  //           }, interval * 1100);
  //         });
  //       }
  //     }
  //   }

  //   return response as GetTokenResponse;
  // }

  // async logout(toOrFrom: ToFromEnum): Promise<void | null> {
  //   try {
  //     const toAndFrom = await getUserCredentials();
  //     const userCredentials =
  //       toOrFrom === ToFromEnum.to ? toAndFrom?.to : toAndFrom?.from;
  //     if (!userCredentials?.refreshToken) {
  //       return null;
  //     }
  //     const { data } = await this.http.post(
  //       '/logout',
  //       {
  //         client_id: this.clientId,
  //         refresh_token: userCredentials.refreshToken,
  //       },
  //       {
  //         headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded',
  //         },
  //       }
  //     );
  //     return data;
  //   } catch (error) {
  //     if (error instanceof AxiosError && error.response?.status === 401) {
  //       return null;
  //     }

  //     throw error;
  //   }
  // }

  // open(url: string): void {
  //   open(url);
  // }

  getAuthorizationCodeURL(
    codeChallenge: string,
    state: string,
    os: NodeJS.Platform
  ): string {
    const queryParams = querystring.stringify({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: CLI_SERVER_ADDRESS_CALLBACK,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    let url = `https://accounts.spotify.com/authorize?${queryParams}`;
    if (os === 'win32') {
      url = url.replace(/&/g, '^&');
    }
    return url;
  }

  async getAuthorizationCodeToken(
    code: string,
    codeVerifier: string
  ): Promise<GetTokenResponse> {
    const { data } = await this.http.post<GetTokenResponse>(
      'https://accounts.spotify.com/api/token',
      {
        client_id: this.clientId,
        redirect_uri: CLI_SERVER_ADDRESS_CALLBACK,
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return data;
  }
}
