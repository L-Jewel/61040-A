import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export interface LimitDoc extends BaseDoc {
  user: ObjectId;
  hourStart: number;
  minuteStart: number;
  hourEnd: number;
  minuteEnd: number;
}

export interface OverrideDoc extends BaseDoc {
  user: ObjectId;
  override: boolean;
}

export default class LimitConcept {
  public readonly limits = new DocCollection<LimitDoc>("limits");
  public readonly overrides = new DocCollection<OverrideDoc>("overrides");

  async add(user: ObjectId, hourStart: number, minuteStart: number, hourEnd: number, minuteEnd: number) {
    // Verify that the start and end times are valid
    this.repInvariant(hourStart, minuteStart, hourEnd, minuteEnd);
    // Verify that this limit isn't a duplicate.
    for (const userLimit of await this.getLimits(user)) {
      if (userLimit.hourStart === hourStart && userLimit.minuteStart === minuteStart && userLimit.hourEnd === hourEnd && userLimit.minuteEnd === minuteEnd) {
        throw new LimitAlreadyExistsError();
      }
    }
    // Create Limit
    const _id = await this.limits.createOne({ user, hourStart, minuteStart, hourEnd, minuteEnd });
    return { msg: "Limit successfully created!", limit: await this.limits.readOne({ _id }) };
  }

  async remove(_id: ObjectId) {
    await this.limits.deleteOne({ _id });
    return { msg: "Limit deleted successfully!" };
  }

  async update(_id: ObjectId, update: Partial<LimitDoc>) {
    this.sanitizeUpdate(update);
    await this.limits.updateOne({ _id }, update);
    return { msg: "Limit successfully updated!" };
  }

  async getLimits(user: ObjectId) {
    const userLimits = await this.limits.readMany({ user });
    return userLimits.sort(this.sortLimits);
  }

  async override(user: ObjectId) {
    const userOverride = await this.overrides.readOne({ user });
    if (userOverride) {
      await this.overrides.updateOne({ _id: userOverride._id }, { override: true });
    } else {
      await this.overrides.createOne({ user, override: true });
    }
    return { msg: "Limit overridden!" };
  }

  async endOverride(user: ObjectId) {
    const userOverride = await this.overrides.readOne({ user });
    if (userOverride) {
      await this.overrides.updateOne({ _id: userOverride._id }, { user, override: false });
    }
    return { msg: "Limit override ceased!" };
  }

  async isUserLimited(user: ObjectId) {
    // Check if limits are currently being overriden
    const userOverride = await this.overrides.readOne({ user });
    if (userOverride && userOverride.override) {
      return;
    }
    // Otherwise, check and see if the current time is in the limits
    const userLimits = await this.getLimits(user);
    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    for (const userLimit of userLimits) {
      // Check if start time occurs "after" end time
      if (userLimit.hourStart > userLimit.hourEnd || (userLimit.hourStart === userLimit.hourEnd && userLimit.minuteStart > userLimit.minuteEnd)) {
        if (currentHour < userLimit.hourStart || (currentHour === userLimit.hourStart && currentMinute < userLimit.minuteStart)) {
          throw new UserLimitedError(user);
        }
      }
      if (currentHour >= userLimit.hourStart && currentHour <= userLimit.hourEnd) {
        if (userLimit.hourEnd === userLimit.hourStart) {
          if (currentMinute >= userLimit.minuteStart && currentMinute < userLimit.minuteEnd) {
            throw new UserLimitedError(user);
          }
        }
        if (currentHour == userLimit.hourStart && currentMinute >= userLimit.minuteStart) {
          throw new UserLimitedError(user);
        }
        if (currentHour == userLimit.hourEnd && currentMinute < userLimit.minuteEnd) {
          throw new UserLimitedError(user);
        }
      }
    }
    return;
  }

  async getNextLimitStart(user: ObjectId) {
    const userLimits = await this.getLimits(user);
    if (userLimits) {
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      for (let i = 0; i < userLimits.length; i++) {
        const currLimit = userLimits[i];
        if (currentHour < currLimit.hourStart || (currentHour == currLimit.hourStart && currentMinute < currLimit.minuteStart)) {
          return { hour: currLimit.hourStart, minute: currLimit.minuteStart };
        }
      }
      return { hour: userLimits[0].hourStart, minute: userLimits[0].minuteStart };
    }
    return { msg: `${user} has no limits` };
  }

  async isCreator(user: ObjectId, _id: ObjectId) {
    const limit = await this.limits.readOne({ _id });
    if (!limit) {
      throw new NotFoundError(`Limit ${_id} does not exist!`);
    }
    if (limit.user.toString() !== user.toString()) {
      throw new LimitCreatorNotMatchError(user, _id);
    }
  }

  private sortLimits(limit1: LimitDoc, limit2: LimitDoc) {
    if (limit1.hourStart < limit2.hourStart) {
      return -1;
    } else if (limit1.hourStart > limit2.hourStart) {
      return 1;
    } else if (limit1.minuteStart < limit2.minuteStart) {
      return -1;
    } else if (limit1.minuteStart > limit2.minuteStart) {
      return 1;
    }
    return 0;
  }

  private repInvariant(hourStart: number, minuteStart: number, hourEnd: number, minuteEnd: number) {
    if (hourStart > 23 || hourStart < 0 || hourEnd > 23 || hourEnd < 0 || minuteStart > 59 || minuteStart < 0 || minuteEnd > 59 || minuteEnd < 0) {
      throw new BadValuesError("Invalid time.");
    }
    if (hourStart == hourEnd && minuteStart == minuteEnd) {
      throw new BadValuesError("Start and end time cannot be the same!");
    }
  }

  private sanitizeUpdate(update: Partial<LimitDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["hourStart", "minuteStart", "hourEnd", "minuteEnd"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
      // Check that update is valid
      if ((key === "hourStart" || key === "hourEnd") && update[key]) {
        if ((update[key] as number) > 23 || (update[key] as number) < 0) {
          throw new BadValuesError("Invalid time.");
        }
      }
      if ((key === "minuteStart" || key === "minuteEnd") && update[key]) {
        if ((update[key] as number) > 59 || (update[key] as number) < 0) {
          throw new BadValuesError("Invalid time.");
        }
      }
    }
  }
}

export class UserLimitedError extends NotAllowedError {
  constructor(public readonly _id: ObjectId) {
    super("This action cannot be performed as {0} is limited.", _id);
  }
}

export class LimitCreatorNotMatchError extends NotAllowedError {
  constructor(
    public readonly creator: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the creator of limit {1}!", creator, _id);
  }
}

export class LimitAlreadyExistsError extends NotAllowedError {
  constructor() {
    super("A limit with these bounds already exists for this user!");
  }
}
