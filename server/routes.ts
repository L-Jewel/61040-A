import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Limit, Post, ScreenTime, Tag, User, Watching, WebSession } from "./app";
import { LimitDoc } from "./concepts/limit";
import { PostDoc, PostOptions } from "./concepts/post";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

class Routes {
  // User + Authentication Methods
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }
  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }
  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }
  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
  }
  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }
  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }
  @Router.get("/search/users/:searchQuery")
  async searchUsers(searchQuery: string) {
    return await User.getUsers(searchQuery);
  }
  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    // Login
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    // Start accumulating screen time
    await ScreenTime.startTime(u._id);
    return { msg: "Logged in!" };
  }
  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    await ScreenTime.stopTime(user);
    await Limit.endOverride(user);
    return { msg: "Logged out!" };
  }

  // Posts Methods
  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }
  @Router.post("/posts")
  async createTaggedPost(session: WebSessionDoc, content: string, tags: string[], options?: PostOptions) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    // Create Post
    const created = await Post.create(user, content, options);
    // Tag said Post
    if (created.post) {
      for (const tag of tags) {
        await Tag.addTag(created.post._id, tag);
      }
    }
    return { msg: created.msg, post: await Responses.post(created.post) };
  }
  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);

    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }
  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    // Verify that the user authored this post
    await Post.isAuthor(user, _id);
    // Delete the tags associated with this post
    const tags = await Tag.getItemTags(new ObjectId(_id));
    for (const tag of tags) {
      await Tag.removeTag(new ObjectId(_id), tag);
    }
    // Delete the posts themselves
    return Post.delete(_id);
  }
  @Router.get("/posts/:_id/tags")
  async getPostTags(_id: ObjectId) {
    return await Tag.getItemTags(new ObjectId(_id));
  }

  // Tag Methods
  @Router.post("/tags")
  async tagPost(session: WebSessionDoc, tag: string, _id: ObjectId) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    // Verify that the user created said post
    await Post.isAuthor(user, _id);
    // Tag post
    return await Tag.addTag(_id, tag);
  }
  @Router.delete("/tags/:tag/:_id")
  async removeTag(session: WebSessionDoc, tag: string, _id: ObjectId) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    // Verify that the user created said post
    await Post.isAuthor(user, _id);
    // Remove tag
    return await Tag.removeTag(_id, tag);
  }
  @Router.get("/tags/:tag")
  async getTaggedPosts(tag: string) {
    return await Tag.getItemsByTag(tag);
  }

  // Watching Methods
  @Router.get("/watch")
  async getWatchlist(session: WebSessionDoc) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    return await Watching.getWatched(user);
  }
  @Router.post("/watch")
  async watchUser(session: WebSessionDoc, watched_id: ObjectId) {
    // Check if the user is Limited
    const watcher = WebSession.getUser(session);
    await Limit.isUserLimited(watcher);
    return await Watching.watch(watcher, watched_id);
  }
  @Router.delete("/watch/:watched")
  async stopWatchingUser(session: WebSessionDoc, watched: ObjectId) {
    // Check if the user is Limited
    const watcher = WebSession.getUser(session);
    await Limit.isUserLimited(watcher);
    return await Watching.stopWatching(watcher, watched);
  }

  // Limit Methods
  @Router.get("/limits")
  async getUserLimits(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Limit.getLimits(user);
  }
  @Router.post("/limits")
  async createLimit(session: WebSessionDoc, hourStart: number, minuteStart: number, hourEnd: number, minuteEnd: number) {
    const user = WebSession.getUser(session);
    return Limit.add(user, hourStart, minuteStart, hourEnd, minuteEnd);
  }
  @Router.patch("/limits/:_id")
  async updateLimit(session: WebSessionDoc, _id: ObjectId, update: Partial<LimitDoc>) {
    const user = WebSession.getUser(session);
    await Limit.isCreator(user, _id);
    return Limit.update(_id, update);
  }
  @Router.delete("/limits/:_id")
  async deleteLimit(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Limit.isCreator(user, _id);
    return Limit.remove(_id);
  }
  @Router.get("/limits/next")
  async nextQuietHour(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return Limit.getNextLimitStart(user);
  }
  @Router.post("/limits/override")
  async overrideLimit(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return Limit.override(user);
  }
  @Router.get("/limits/isLimited")
  async isUserLimited(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);
    return { msg: "User is not limited!" };
  }

  // Screen Time Methods
  // @Router.post("/screenTime/startTime")
  // async startScreenTime(session: WebSessionDoc) {
  //   const user = WebSession.getUser(session);
  //   return ScreenTime.startTime(user);
  // }
  // @Router.post("/screenTime/stopTime")
  // async stopScreenTime(session: WebSessionDoc) {
  //   const user = WebSession.getUser(session);
  //   return ScreenTime.stopTime(user);
  // }
  @Router.get("/screenTime/lastLogin")
  async getLastLogin(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return ScreenTime.getLastStart(user);
  }
  @Router.get("/screenTime/data")
  async retrieveUserData(session: WebSessionDoc, t?: Date) {
    const user = WebSession.getUser(session);
    return ScreenTime.getUserData(user, t);
  }

  // Feed
  @Router.get("/feed")
  async getFeed(session: WebSessionDoc) {
    // Check if the user is Limited
    const user = WebSession.getUser(session);
    await Limit.isUserLimited(user);

    const watchlist = await Watching.getWatched(user);
    const lastLogin = await ScreenTime.getLastStart(user);
    const feed = [];
    for (const watched of watchlist) {
      feed.push(await Post.getByAuthor(watched, lastLogin));
    }
    return feed;
  }
}

export default getExpressRouter(new Routes());
