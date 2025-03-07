import { createHashHistory } from 'history'
import { route } from 'preact-router'

export default class History {
  static history = createHashHistory()

  static message = {}

  static push(theRoute, message) {
    route(theRoute)
    this.history.replace(theRoute, message)
  }

  static replace(theRoute, message) {
    route(theRoute, true)
    this.history.replace(theRoute, message)
  }
}
