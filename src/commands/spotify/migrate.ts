import { ux, Command, Flags } from '@oclif/core';

import { CLIError, ExitError } from '@oclif/core/lib/errors';
import EventEmitter = require('node:events');
import * as http from 'node:http';
import * as querystring from 'node:querystring';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as os from 'node:os';

import { SpotifyService, ToFromEnum } from '../../services/spotify.service';
import {
  CLI_SERVER_ADDRESS,
  CLI_SERVER_ADDRESS_CALLBACK,
  generatePkceChallenge,
  getUserCredentials,
  saveUserCredentials,
  Tokens,
  UserCredentials,
  waitFor,
} from '../../utils';

type AuthoricationCodeCallbackParams = {
  state: string;
  code: string;
  session_state: string;
};

export default class Migrate extends Command {
  static description = 'Authenticate with Spotify';

  spotifyService = new SpotifyService();

  static flags = {
    flow: Flags.string({
      char: 'f',
      description: 'Authentication flow',
      options: ['device-code', 'authorization-code'],
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Migrate);

    try {
      await this.checkUserAlreadyLoggedIn();

      let userCredentials: UserCredentials = {
        to: {
          accessToken: '',
          refreshToken: '',
        },
        from: {
          accessToken: '',
          refreshToken: '',
        },
      };

      this.log('Starting authentication process for Spotify...');

      this.log(
        'Please log into the account you want to transfer songs from...'
      );

      switch (flags.flow) {
        case 'authorization-code':
          userCredentials.from = await this.startAuthorizationCodeFlow();
          break;
        default:
          userCredentials.from = await this.startAuthorizationCodeFlow();
          break;
      }

      this.log('Please log into the account you want to transfer songs to...');

      switch (flags.flow) {
        case 'authorization-code':
          userCredentials.to = await this.startAuthorizationCodeFlow();
          break;
        default:
          userCredentials.to = await this.startAuthorizationCodeFlow();
          break;
      }

      ux.action.stop('done ✅');
      saveUserCredentials(userCredentials);
    } catch (error) {
      if (
        (error instanceof CLIError && error.message === 'ctrl-c') ||
        error instanceof ExitError
      )
        this.exit(0);
      else if (error instanceof Error) {
        ux.action.stop(error.message);

        this.exit(1);
      }
    }
  }

  private getDefaultBrowserName() {
    let browserName = '';
    switch (os.platform()) {
      case 'darwin':
        browserName = execSync(
          'defaults read -g NSGlobalDomain AppleDefaultWebBrowser'
        )
          .toString()
          .trim();
        break;
      case 'win32':
        browserName = execSync(
          'REG QUERY HKEY_CLASSES_ROOT\\http\\shell\\open\\command /ve | grep -i "(default)"'
        )
          .toString()
          .replace(/ /g, '')
          .replace(/(.*\\)*|\.(exe|EXE)/g, '')
          .trim();
        break;
      default:
        browserName = execSync('xdg-mime query default x-scheme-handler/http')
          .toString()
          .trim()
          .split('.')[0];
        break;
    }
    return browserName.toLowerCase();
  }

  private async isUserLoggedIn() {
    const userCredentials = await getUserCredentials();
    const loggedIn =
      userCredentials?.to?.accessToken != null &&
      userCredentials?.to?.refreshToken != null &&
      userCredentials?.from?.accessToken != null &&
      userCredentials?.from?.refreshToken != null;
    return loggedIn;
  }

  private async startAuthorizationCodeFlow(): Promise<Tokens> {
    const { codeVerifier, codeChallenge, state } = generatePkceChallenge();
    const port = CLI_SERVER_ADDRESS.split(':').pop();
    const callbackPath = CLI_SERVER_ADDRESS_CALLBACK.split(':')[2].replace(
      port!,
      ''
    );

    const emmiter = new EventEmitter();
    const eventName = 'authorication_code_callback_params';
    let childProcess: ChildProcess;
    const server = http
      .createServer((req, res) => {
        if (req?.url?.startsWith(callbackPath)) {
          const params = querystring.decode(
            req?.url.replace(`${callbackPath}?`, '')
          ) as AuthoricationCodeCallbackParams;

          emmiter.emit(eventName, params);

          res.end('You can close this browser now.');

          res.socket?.end();
          res.socket?.destroy();
          server.close();
          if (childProcess) {
            childProcess.kill();
          }
        } else {
          res.end('Unsupported');
          emmiter.emit(eventName, new Error('Invalid URL address'));
        }
      })
      .listen(port);

    await ux.anykey('Press any key to open Spotify in your browser');

    const authorizationCodeURL = this.spotifyService.getAuthorizationCodeURL(
      codeChallenge,
      state,
      os.platform()
    );

    const [command, args] = this.getCommandAndArgs(
      os.platform(),
      authorizationCodeURL
    );
    childProcess = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    childProcess.unref();

    ux.action.start('Waiting for authentication');

    const { code, state: stateFromParams } =
      await waitFor<AuthoricationCodeCallbackParams>(eventName, emmiter);

    if (stateFromParams !== state) {
      throw new Error('Something went wrong, Aborting login! ⚠️');
    }

    const { access_token, refresh_token } =
      await this.spotifyService.getAuthorizationCodeToken(code, codeVerifier);

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
    };
  }

  private getCommandAndArgs(
    platform: NodeJS.Platform,
    url: string
  ): [string, string[]] {
    const args = [url];
    let command = '';
    switch (platform) {
      case 'darwin':
        command = 'open';
        return [command, args];
      case 'win32':
        command = 'cmd';
        args.unshift('/c', 'start');
        return [command, args];
      default:
        command = 'xdg-open';
        return [command, args];
    }
  }
}
