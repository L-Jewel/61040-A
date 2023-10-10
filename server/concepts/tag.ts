import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export interface TagDoc extends BaseDoc {
  item: ObjectId;
  tag: string;
}

export default class TagConcept {
  public readonly tags = new DocCollection<TagDoc>("tags");

  async addTag(item: ObjectId, tag: string) {
    if (tag && item) {
      if (this.isInvalidTag(tag)) {
        throw new BadValuesError("Tags cannot contain whitespace.");
      }
      // If the tag already exists, don't make another one.
      if (await this.itemHasTag(item, tag)) {
        throw new TagAlreadyExistsError(tag);
      }
      void this.tags.createOne({ item, tag });
      return { msg: `Added tag #${tag} to item!` };
    }
    throw new BadValuesError("This action requires a Post and a Tag");
  }

  async removeTag(item: ObjectId, tag: string) {
    const removedTag = await this.tags.popOne({ item, tag });
    if (removedTag === null) {
      throw new TagNotFoundError(tag);
    }
    return { msg: `Removed tag #${tag} from item!` };
  }

  async getItemTags(item: ObjectId) {
    const itemTags = await this.tags.readMany({
      item,
    });
    return itemTags.map((itemTag) => itemTag.tag);
  }

  async getItemsByTag(tag: string) {
    const taggedItems = await this.tags.readMany({ tag });
    return taggedItems.map((taggedItem) => taggedItem.item);
  }

  private isInvalidTag(tag: string): boolean {
    return /\s/.test(tag);
  }

  private async itemHasTag(item: ObjectId, tag: string): Promise<boolean> {
    const itemTag = await this.tags.readOne({ item, tag });
    return !(itemTag === null);
  }
}

export class TagNotFoundError extends NotFoundError {
  constructor(public readonly tag: string) {
    super("Tag #{0} does not exist on the given item.", tag);
  }
}

export class TagAlreadyExistsError extends NotAllowedError {
  constructor(public readonly tag: string) {
    super("Tag #{0} already exists on the given item.", tag);
  }
}
