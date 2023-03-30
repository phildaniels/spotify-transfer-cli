import { Command } from '@oclif/core';

import { SpotifyService } from '../../services/spotify.service';
import { saveUserCredentials } from '../../utils';

export default class AuthLogout extends Command {
  static description = 'Log out of Spotify';

  public async run(): Promise<void> {
    saveUserCredentials({
      to: {
        accessToken: '',
        refreshToken: '',
      },
      from: {
        accessToken: '',
        refreshToken: '',
      },
    });

    this.log('Logged out of Spotify ✅');
  }
}
