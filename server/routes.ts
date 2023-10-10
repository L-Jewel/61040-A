import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Post, Tag, User, Watching, WebSession } from "./app";
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
  @Router.get("/users/search/:searchQuery")
  async searchUsers(searchQuery: string) {
    return await User.getUsers(searchQuery);
  }
  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }
  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
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
  async createTaggedPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    // console.log(content, tags);
    // // Create Post
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
    // // Tag said Post
    // if (created.post) {
    //   for (const tag of tags) {
    //     console.log(tag);
    //     await Tag.addTag(created.post._id, tag);
    //   }
    // }
    return { msg: created.msg, post: await Responses.post(created.post) };
  }
  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }
  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return Post.delete(_id);
  }
  @Router.get("/posts/:_id/tags")
  async getPostTags(_id: ObjectId) {
    return await Tag.getItemTags(_id);
  }

  // Tag Methods
  @Router.post("/tags")
  async tagPost(session: WebSessionDoc, tag: string, _id: ObjectId) {
    // Verify that the user created said post
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    // Tag post
    return await Tag.addTag(_id, tag);
  }
  @Router.delete("/tags/:tag/:_id")
  async removeTag(session: WebSessionDoc, tag: string, _id: ObjectId) {
    // Verify that the user created said post
    const user = WebSession.getUser(session);
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
    const user = WebSession.getUser(session);
    return await Watching.getWatched(user);
  }
  @Router.post("/watch")
  async watchUser(session: WebSessionDoc, watched_id: ObjectId) {
    const watcher = WebSession.getUser(session);
    return await Watching.watch(watcher, watched_id);
  }
  @Router.delete("/watch/:watched")
  async stopWatchingUser(session: WebSessionDoc, watched: ObjectId) {
    const watcher = WebSession.getUser(session);
    return await Watching.stopWatching(watcher, watched);
  }

  // Get all of the user's limits
  @Router.get("/limits")
  async getUserLimits(session: WebSessionDoc) {}

  // Set a limit from time (t1) to time (t2)
  @Router.post("/limit/:t1/:t2")
  async createLimit(session: WebSessionDoc, t1: string, t2: string) {}

  // Update the limit with ID (_id)
  @Router.patch("/limit/:_id")
  async updateLimit(session: WebSessionDoc, _id: ObjectId) {}

  // Delete the limit with ID (_id)
  @Router.delete("/limit/:_id")
  async deleteLimit(session: WebSessionDoc, _id: ObjectId) {}

  // Start counting screen time
  @Router.post("/screenTime/startTime")
  async startScreenTime(session: WebSessionDoc) {}

  // Stop counting screen time
  @Router.post("/screenTime/stopTime")
  async stopScreenTime(session: WebSessionDoc) {}

  // Get the last time that the user logged in
  @Router.get("/screenTime/lastLogin")
  async getLastLogin(session: WebSessionDoc) {}

  // retrieve the screen time data for the user from time (t) to now
  // if time t is not specified, get all user data
  @Router.get("/screenTime/data/:t")
  async retrieveUserData(session: WebSessionDoc, t: Date) {}
}

export default getExpressRouter(new Routes());
