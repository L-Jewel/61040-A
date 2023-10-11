import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "./errors";

export interface ScreenTimeDoc extends BaseDoc {
  user: ObjectId;
  date: Date;
  screenTimeMins: number;
}

export interface LogsDoc extends BaseDoc {
  user: ObjectId;
  time: Date;
}

export default class ScreenTimeConcept {
  public readonly data = new DocCollection<ScreenTimeDoc>("screen-time-data");
  public readonly logs = new DocCollection<LogsDoc>("logs");

  async startTime(user: ObjectId) {
    // Log the start of this session
    await this.logs.createOne({ user, time: new Date() });
    return { msg: `${user}'s screen time is now accumulating.` };
  }

  async stopTime(user: ObjectId) {
    const endTime = new Date();
    const lastStart = await this.logs.readOne({ user }, { sort: { time: -1 } });
    if (!lastStart) {
      throw new NotFoundError("For some reason, this session never started?");
    }
    const startTime = lastStart.time;
    // If the session starts and ends on the same day,
    if (this.dateIsEqual(startTime, endTime)) {
      const sessionDurationMinutes = this.timeToMinutes(endTime.getHours(), endTime.getMinutes()) - this.timeToMinutes(startTime.getHours(), startTime.getMinutes());
      await this.addMinutesToScreenTime(user, endTime, sessionDurationMinutes);
    } else {
      // Otherwise, do it for each day
      await this.addMinutesToScreenTime(user, startTime, 1440 - this.timeToMinutes(startTime.getHours(), startTime.getMinutes()));
      while (!this.dateIsEqual(startTime, endTime)) {
        startTime.setDate(startTime.getDate() + 1);
        if (this.dateIsEqual(startTime, endTime)) {
          await this.addMinutesToScreenTime(user, endTime, this.timeToMinutes(endTime.getHours(), endTime.getMinutes()));
          break;
        }
        await this.addMinutesToScreenTime(user, startTime, 1400);
      }
    }

    return { msg: `${user}'s screen time is no longer accumulating.` };
  }

  async getLastStart(user: ObjectId) {
    const userLogs = await this.logs.readMany({ user }, { sort: { time: -1 } });
    if (userLogs[1]) {
      return userLogs[1].time;
    }
    throw new NotFoundError("This is the user's first session!");
  }

  async getUserData(user: ObjectId, dateFilter?: Date) {
    if (dateFilter) {
      return await this.data.readMany({ user, date: { $gte: dateFilter } });
    }
    return await this.data.readMany({ user });
  }

  private async addMinutesToScreenTime(user: ObjectId, date: Date, minutes: number) {
    const screenTimeDate = this.dateToTimelessDate(date);
    const screenTimeToday = await this.data.readOne({ user, date: screenTimeDate });
    if (screenTimeToday) {
      await this.data.updateOne({ _id: screenTimeToday._id }, { screenTimeMins: screenTimeToday.screenTimeMins + minutes });
      return;
    }
    await this.data.createOne({ user, date: screenTimeDate, screenTimeMins: minutes });
  }

  private dateIsEqual(date1: Date, date2: Date) {
    return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDay() === date2.getDay();
  }

  private dateToTimelessDate(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private timeToMinutes(hour: number, minute: number) {
    return hour * 60 + minute;
  }
}
