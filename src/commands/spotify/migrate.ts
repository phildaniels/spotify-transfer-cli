import { ux, Command, Flags } from '@oclif/core';

import { CLIError, ExitError } from '@oclif/core/lib/errors';
import EventEmitter = require('node:events');
import * as http from 'node:http';
import * as querystring from 'node:querystring';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as os from 'node:os';

import { SpotifyService, ToFromEnum } from '../../services/spotify.service';
import { getUserCredentials } from '../../utils';

export default class Migrate extends Command {
  static description =
    'Migrate liked songs from one Spotify account to another';
  spotifyService = new SpotifyService();

  public async run(): Promise<void> {
    const { flags } = await this.parse(Migrate);
    try {
      const loggedIn = await this.isUserLoggedIn();
      if (!loggedIn) {
        this.log('You are not logged in. Please run login command first');
      }

      const fromLikedSongs = await this.spotifyService.getFromUserLikedSongs();

      ux.action.start('Migrating liked songs...');

      ux.action.stop('done ✅');
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

  private async isUserLoggedIn() {
    const userCredentials = await getUserCredentials();
    const loggedIn =
      (userCredentials?.to?.accessToken ?? '') !== '' &&
      (userCredentials?.to?.refreshToken ?? '') !== '' &&
      (userCredentials?.from?.accessToken ?? '') !== '' &&
      (userCredentials?.from?.refreshToken ?? '') !== '';
    return loggedIn;
  }
}
