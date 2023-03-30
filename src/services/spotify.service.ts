import axios, { AxiosError, AxiosInstance } from 'axios';
import * as querystring from 'node:querystring';
import open from 'open';
import {
  CLI_SERVER_ADDRESS_CALLBACK,
  getUserCredentials,
  saveUserCredentials,
  SPOTIFY_SERVER_ADDRESS,
  UserCredentials,
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
  fromHttp: AxiosInstance;
  toHttp: AxiosInstance;
  clientId: string;
  currentUserCredentials: UserCredentials | null = null;

  constructor() {
    this.http = axios.create();
    this.fromHttp = axios.create();
    this.toHttp = axios.create();
    this.fromHttp.interceptors.request.use(async (request) => {
      const userCredentials =
        this.currentUserCredentials ?? (await getUserCredentials());
      this.currentUserCredentials = userCredentials;
      if (!this.currentUserCredentials) {
        return request;
      }
      if ((this.currentUserCredentials?.from?.accessToken ?? '') !== '') {
        request.headers.Authorization = `Bearer ${this.currentUserCredentials?.from.accessToken}`;
      }
      return request;
    });

    this.fromHttp.interceptors.response.use(async (response) => {
      const userCredentials =
        this.currentUserCredentials ?? (await getUserCredentials());
      this.currentUserCredentials = userCredentials;
      if (!this.currentUserCredentials) {
        return response;
      }
      if (
        response.status === 401 &&
        response.config.headers['X-Retry'] == null
      ) {
        const { data } = await this.http.post<GetTokenResponse>(
          'https://accounts.spotify.com/api/token',
          {
            client_id: this.clientId,
            grant_type: 'refresh_token',
            refresh_token: this.currentUserCredentials.from.refreshToken,
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        this.currentUserCredentials.from.accessToken = data.access_token;
        await saveUserCredentials({
          to: this.currentUserCredentials.to,
          from: {
            accessToken: data.access_token,
            refreshToken: this.currentUserCredentials.from.refreshToken,
          },
        });
        response.config.headers.Authorization = `Bearer ${data.access_token}`;
        response.config.headers['X-Retry'] = 'true';
        const newResponse = await this.fromHttp.request(response.config);
        return newResponse;
      }
      return response;
    });

    this.fromHttp.interceptors.request.use(async (request) => {
      const userCredentials =
        this.currentUserCredentials ?? (await getUserCredentials());
      this.currentUserCredentials = userCredentials;
      if (!this.currentUserCredentials) {
        return request;
      }
      if ((this.currentUserCredentials?.from?.accessToken ?? '') !== '') {
        request.headers.Authorization = `Bearer ${this.currentUserCredentials.from.accessToken}`;
      }
      return request;
    });

    this.toHttp.interceptors.response.use(async (response) => {
      const userCredentials =
        this.currentUserCredentials ?? (await getUserCredentials());
      this.currentUserCredentials = userCredentials;
      if (!this.currentUserCredentials) {
        return response;
      }
      if (
        response.status === 401 &&
        response.config.headers['X-Retry'] == null
      ) {
        const { data } = await this.http.post<GetTokenResponse>(
          'https://accounts.spotify.com/api/token',
          {
            client_id: this.clientId,
            grant_type: 'refresh_token',
            refresh_token: this.currentUserCredentials.to.refreshToken,
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        this.currentUserCredentials.to.accessToken = data.access_token;
        await saveUserCredentials({
          from: this.currentUserCredentials.from,
          to: {
            accessToken: data.access_token,
            refreshToken: this.currentUserCredentials.to.refreshToken,
          },
        });
        response.config.headers.Authorization = `Bearer ${data.access_token}`;
        response.config.headers['X-Retry'] = 'true';
        const newResponse = await this.toHttp.request(response.config);
        return newResponse;
      }
      return response;
    });

    this.clientId = 'd64ca1f7e091459494fbeef881a6273e';
  }

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

    let url = `https://accounts.spotify.com/authorize?${queryParams}&scope=${[
      'user-library-read',
      'user-library-modify',
    ].join(' ')}`;
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
        scopes: ['user-library-read', 'user-library-modify'].join(' '),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return data;
  }

  async getFromUserLikedSongs(): Promise<string[]> {
    const trackIds: string[] = [];
    let next = 'https://api.spotify.com/v1/me/tracks?limit=50';
    while (next != null) {
      try {
        const response = await this.fromHttp.get<UserLikedSongs>(next);
        const trackIds = response.data.items.map((item) => item.track.id);
        trackIds.push(...trackIds);
        next = response.data.next;
      } catch (error) {
        console.log(error);
        throw error;
      }
    }
    return trackIds;
  }
}

export interface UserLikedSongs {
  href: string;
  limit: number;
  next: string;
  offset: number;
  previous: string;
  total: number;
  items: Item[];
}

export interface Item {
  added_at: string;
  track: Track;
}

export interface Track {
  album: Album;
  artists: TrackArtist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids: ExternalIDS;
  external_urls: ExternalUrls;
  href: string;
  id: string;
  is_playable: boolean;
  linked_from: LinkedFrom;
  restrictions: Restrictions;
  name: string;
  popularity: number;
  preview_url: string;
  track_number: number;
  type: string;
  uri: string;
  is_local: boolean;
}

export interface Album {
  album_type: string;
  total_tracks: number;
  available_markets: string[];
  external_urls: ExternalUrls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  restrictions: Restrictions;
  type: string;
  uri: string;
  copyrights: Copyright[];
  external_ids: ExternalIDS;
  genres: string[];
  label: string;
  popularity: number;
  album_group: string;
  artists: AlbumArtist[];
}

export interface AlbumArtist {
  external_urls: ExternalUrls;
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

export interface ExternalUrls {
  spotify: string;
}

export interface Copyright {
  text: string;
  type: string;
}

export interface ExternalIDS {
  isrc: string;
  ean: string;
  upc: string;
}

export interface Image {
  url: string;
  height: number;
  width: number;
}

export interface Restrictions {
  reason: string;
}

export interface TrackArtist {
  external_urls: ExternalUrls;
  followers: Followers;
  genres: string[];
  href: string;
  id: string;
  images: Image[];
  name: string;
  popularity: number;
  type: string;
  uri: string;
}

export interface Followers {
  href: string;
  total: number;
}

export interface LinkedFrom {}
