import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface WatchingDoc extends BaseDoc {
  watcher: ObjectId;
  watched: ObjectId;
}

export default class WatchingConcept {
  public readonly watching = new DocCollection<WatchingDoc>("watching");

  async watch(watcher: ObjectId, watched: ObjectId) {
    if (await this.isWatching(watcher, watched)) {
      throw new AlreadyWatchingError(watcher, watched);
    } else if (watcher.equals(watched)) {
      throw new NotAllowedError("You cannot watch yourself!");
    }
    await this.watching.createOne({ watcher, watched });
    return { msg: `${watcher} is now watching ${watched}` };
  }

  async stopWatching(watcher: ObjectId, watched: ObjectId) {
    const watching = this.watching.popOne({ watcher, watched });
    if (watching === null) {
      throw new WatchingNotFoundError(watcher, watched);
    }
    return { msg: `${watcher} is no longer watching ${watched}` };
  }

  async getWatchlist(watcher: ObjectId) {
    const allWatched = await this.watching.readMany({ watcher });
    return allWatched.map((watching) => watching.watched);
  }

  private async isWatching(watcher: ObjectId, watched: ObjectId): Promise<boolean> {
    const watching = await this.watching.readOne({ watcher, watched });
    return !(watching === null);
  }
}

export class AlreadyWatchingError extends NotAllowedError {
  constructor(
    public readonly watcher: ObjectId,
    public readonly watched: ObjectId,
  ) {
    super("{0} is already watching {1}", watcher, watched);
  }
}

export class WatchingNotFoundError extends NotFoundError {
  constructor(
    public readonly watcher: ObjectId,
    public readonly watched: ObjectId,
  ) {
    super("{0} is not currently watching {1}", watcher, watched);
  }
}
