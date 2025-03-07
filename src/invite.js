import { h, Fragment, Component } from 'preact';
import UserPill from './userPill.js'
import MemberPill from './memberPill.js'
import Client from './client.js'
import SearchBar from './search.js'
import * as Icons from './icons.js'
import './styles/invite.css'

export default class Invite extends Component {
  constructor(props) {
    super(props)
    const joins = this.props.room.getMembersWithMembership("join")
      .sort((u1, u2) => u1.name.toUpperCase() > u2.name.toUpperCase() ? 1 : -1)
    const invites = this.props.room.getMembersWithMembership("invite")
      .sort((u1, u2) => u1.name.toUpperCase() > u2.name.toUpperCase() ? 1 : -1)
    const memberIds = joins.map(join => join.userId).concat(invites.map(invite => invite.userId))
    this.state = {
      adding: true,
      joins,
      invites,
      memberIds,
      search: ""
    }
  }

  componentDidMount () {
    Client.client.on("RoomMember.membership", this.updateMembership)
  }

  componentWillUnmount () {
    Client.client.off("RoomMember.membership", this.updateMembership)
  }

  updateMembership = event => {
    const joins = this.props.room.getMembersWithMembership("join")
      .sort((u1, u2) => u1.name.toUpperCase() > u2.name.toUpperCase() ? 1 : -1)
    const invites = this.props.room.getMembersWithMembership("invite")
      .sort((u1, u2) => u1.name.toUpperCase() > u2.name.toUpperCase() ? 1 : -1)
    const memberIds = joins.map(join => join.userId).concat(invites.map(invite => invite.userId))
    if (event.getRoomId() === this.props.room.roomId) this.setState({ joins, invites, memberIds })
  }

  filterMembers = search => this.setState({ search })

  addMembers = _ => this.setState({ adding: true })

  removeMembers = _ => this.setState({ adding: false })

  render(props, state) {
    console.log(state)
    const additions = state.adding && Client.client.getUsers()
      .filter(u => !state.memberIds.includes(u.userId))
      .filter(u => u.displayName.toUpperCase().includes(state.search.toUpperCase()))
      .sort((u1, u2) => u1.displayName.toUpperCase() > u2.displayName.toUpperCase() ? 1 : -1)
    const removals = !state.adding && state.joins.filter(m => m.name.toUpperCase().includes(state.search.toUpperCase()))
    const invites = !state.adding && state.invites.filter(m => m.name.toUpperCase().includes(state.search.toUpperCase()))

    return <Fragment>
      <h3 id="modalHeader">Manage Membership {props.room.name ? `for ${props.room.name}` : ""}</h3>
      <SearchBar search={state.search} setSearch={this.filterMembers} />
      <div id="invite-select-view" class="select-view">
        <button onClick={this.addMembers} data-current-button={state.adding}>Add Members</button>
        <button onClick={this.removeMembers} data-current-button={!state.adding}>Remove Members</button>
      </div>
      { state.adding
        ? <div style={{height: `${(additions.length * 40) + 50}px` }} id="invite-add-members">
          <div>
            { additions.map(u => <Invitation user={u} room={props.room} key={u.userId} />) }
          </div>
          <ServerResults search={state.search} memberIds={state.memberIds} additions={additions} room={props.room} />
        </div>
        : <div style={{height: `${(removals.length + invites.length) * 40}px`}}id="invite-remove-members">
          { removals.map(m => <Removal member={m} room={props.room} key={m.userId} />) }
          { invites.map(m => <Disinvitation member={m} room={props.room} key={m.userId} />) }
        </div>
      }
    </Fragment>
  }
}

class Invitation extends Component {
  invite = _ => Client.client
    .invite(this.props.room.roomId, this.props.user.userId || this.props.user.user_id)
    // ^^^ handles raw results from the user directory which have user_id rather than userId
    .catch(alert)

  render(props) {
    return <button class="invite-candidate" onclick={this.invite} >
      <span class="small-icon">{Icons.userPlus}</span>
      <UserPill user={props.user} />
    </button>
  }
}

class Disinvitation extends Component {
  kick = _ => Client.client
    .kick(this.props.room.roomId, this.props.member.userId)
    .catch(alert)

  render(props) {
    return <button class="disinvite-candidate" onclick={this.kick}>
      <span class="small-icon">{Icons.userMinus}</span>
      <MemberPill member={props.member} />
    </button>
  }
}

class Removal extends Component {
  kick = _ => Client.client
    .kick(this.props.room.roomId, this.props.member.userId)
    .catch(alert)

  render(props) {
    return <button class="removal-candidate" onclick={this.kick}>
      <span class="small-icon">{Icons.userMinus}</span>
      <MemberPill member={props.member} />
    </button>
  }
}

class ServerResults extends Component {
  constructor(props) {
    super(props)
    this.state = {
      results: [],
      pending: false,
      fired: false
    }
  }

  serverSearch = async _ => {
    this.setState({pending: true})
    const { results } = await Client.client.searchUserDirectory({term: this.props.search})
    this.setState({results, fired: true, pending: false})
  }

  render(props, state) {
    const buttonStyle = {
      visibility: props.search ? "visible" : "hidden"
    }
    const candidates = state.results
      .filter(u => !props.additions.map(a => a.userId).includes(u.user_id))
      .filter(u => !props.memberIds.includes(u.user_id))
      .filter(u => u.display_name
        ? u.display_name.toUpperCase().includes(props.search.toUpperCase())
        : u.user_id.toUpperCase().includes(props.search.toUpperCase())
      )
    return <Fragment>
      { state.fired && candidates.length > 0 ? <hr id="invite-search-divider" /> : null }
      { candidates.map(u => <Invitation key={u.user_id} user={u} room={props.room} />)
      }
      <div>
        <button style={buttonStyle} id="invite-search-directory" class="styled-button" disabled={state.pending} onclick={this.serverSearch}>
          {state.fired
            ? "Search again?"
            : "Search for more people?"
          }
        </button>
      </div>
    </Fragment>
  }
}
