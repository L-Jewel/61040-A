import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Friend, Post, User, WebSession } from "./app";
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
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
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

  // Retrieves the tags of the post with ID _id
  @Router.get("/posts/:id/tags")
  async getPostTags(_id: ObjectId) {}

  // Search GET Methods

  @Router.get("/search/users/:searchQuery")
  async searchUsers(searchQuery: string) {
    return await User.getUsers(searchQuery);
  }

  // Friend methods

  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
  }

  // Tags the post (_id) with a tag (tag)
  @Router.post("/tags/:tag/:_id")
  async tagPost(session: WebSessionDoc, tag: string, _id: ObjectId) {}

  // Removes the tag (tag) from the post (_id)
  @Router.delete("/tags/:tag/:_id")
  async removeTag(session: WebSessionDoc, tag: string, _id: ObjectId) {}

  // Gets all posts that have the tag (tag)
  @Router.get("/tags/:tag")
  async getTaggedPosts(tag: string) {}

  // Get the list of all accounts that the current user is watching
  @Router.get("/watch")
  async getWatchlist(session: WebSessionDoc) {}

  // Watch account (_id)
  @Router.post("/watch/:_id")
  async watchUser(session: WebSessionDoc, _id: ObjectId) {}

  // Stop watching account (_id)
  @Router.delete("/watch/:_id")
  async stopWatchingUser(session: WebSessionDoc, _id: ObjectId) {}

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
