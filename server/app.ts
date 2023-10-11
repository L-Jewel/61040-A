import FriendConcept from "./concepts/friend";
import LimitConcept from "./concepts/limit";
import PostConcept from "./concepts/post";
import ScreenTimeConcept from "./concepts/screenTime";
import TagConcept from "./concepts/tag";
import UserConcept from "./concepts/user";
import WatchingConcept from "./concepts/watching";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Tag = new TagConcept();
export const Watching = new WatchingConcept();
export const Limit = new LimitConcept();
export const ScreenTime = new ScreenTimeConcept();
