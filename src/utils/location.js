import Client from '../client.js'
import { eventVersion, spaceParent, spaceChild, mscLocation, populusHighlight, mscPdfHighlight, mscMarkupMsgKey, mscParent } from "../constants.js"

export default class Location {
  constructor(theEvent) {
    this.event = theEvent
    this.location = this.event.getContent()[mscLocation] ||
      this.event.getContent()[mscMarkupMsgKey]?.[mscLocation]
  }

  isValid() {
    if (!this.location) return false
    if (!this.getPageIndex()) return false
    if (!this.getStatus()) return false
    if (!this.getCreator()) return false
    if (!this.getType()) return false
    return true
  }

  getUnread() {
    const room = Client.client.getRoom(this.getChild())
    if (room) return room.getUnreadNotificationCount()
    return "All"
  }

  getText() {
    return this.location?.[mscPdfHighlight]?.text_content
  }

  getPageIndex() {
    return this.location?.[mscPdfHighlight]?.page_index
  }

  getStatus() {
    return this.location?.[populusHighlight]?.activityStatus
  }

  getCreator() {
    return this.location?.[populusHighlight]?.creator
  }

  getType() {
    if (this.location?.[mscPdfHighlight]) return "highlight"
    return null
  }

  getParent() {
    if (this.event.getType() === spaceParent) return this.event.getStateKey()
    if (this.event.getType() === spaceChild) return this.event.getRoomId()
    if (this.event.getType() === "m.room.message") {
      return this.event.getContent()[mscMarkupMsgKey]?.[mscParent]
    }
  }

  getChild() {
    if (this.event.getType() === spaceParent) return this.event.getRoomId()
    if (this.event.getType() === spaceChild) return this.event.getStateKey()
    if (this.event.getType() === "m.room.message") return this.event.getRoomId()
  }
}
