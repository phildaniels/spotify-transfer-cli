import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import EventEmitter = require('node:events');

const CONFIG_PATH = path.resolve(os.homedir(), '.sptofiyclirc');
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657';
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`;
export const SPOTIFY_SERVER_ADDRESS = 'http://127.0.0.1:8080';

export type UserCredentials = {
  to: Tokens;
  from: Tokens;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export const saveUserCredentials = async (
  data: UserCredentials
): Promise<void> => {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
  });
};

export const getUserCredentials = async (): Promise<UserCredentials | null> => {
  try {
    const content = await fs.readFile(CONFIG_PATH, {
      encoding: 'utf-8',
    });

    return JSON.parse(content) as UserCredentials;
  } catch {
    return null;
  }
};

export const generatePkceChallenge = (): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
} => {
  const codeVerifier = crypto.randomBytes(64).toString('hex');

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    state: crypto.randomBytes(32).toString('hex'),
    codeVerifier,
    codeChallenge,
  };
};

export const waitFor = <T>(
  eventName: string,
  emitter: EventEmitter
): Promise<T> => {
  const promise = new Promise<T>((resolve, reject) => {
    const handleEvent = (eventData: any): void => {
      eventData instanceof Error ? reject(eventData) : resolve(eventData);

      emitter.removeListener(eventName, handleEvent);
    };

    emitter.addListener(eventName, handleEvent);
  });

  return promise;
};
