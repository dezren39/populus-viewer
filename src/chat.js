import * as sdk from "matrix-js-sdk"
import { h, Fragment, Component } from 'preact';
import './styles/chat.css'
import * as CommonMark from 'commonmark'

export default class Chat extends Component {
    constructor (props) {
        super(props)
        this.state = {
            typing : [],
            events : [],
            value : "",
            fullyScrolled : false,
        }
        this.scrolledIdents = new Set()
        this.reader = new CommonMark.Parser()
        this.writer = new CommonMark.HtmlRenderer()
        this.handleTimeline = this.handleTimeline.bind(this)
        this.handleTypingNotifications = this.handleTypingNotification.bind(this)
    }

    componentDidMount() { 
        this.props.client.on("Room.timeline", this.handleTimeline) 
        this.props.client.on("RoomMember.typing", this.handleTypingNotification) 
    }

    componentWillUnmount() { 
        this.props.client.off("Room.timeline", this.handleTimeline) 
        this.props.client.off("RoomMember.typing", this.handleTypingNotification) 
    }

    handleTimeline = (event, room, toStart) => {
        if (this.props.focus && this.props.focus.room_id == event.getRoomId()) {
            this.setState({ 
                events : room.getLiveTimeline().getEvents() 
            })
        }
    }

    handleTypingNotification = (event,member) => {
        if (member.roomId == this.props.focus.room_id) {
            //^^^ we have to check the originating room in an odd way because
            //the room_id for the typing events isn't set for some reason,
            //maybe a bug in dendrite
            const myId = this.props.client.getUserId()
            const typingOtherThanMe = event.getContent().user_ids.filter(x => x != myId)
            this.setState({ typing : typingOtherThanMe })
        }
    }

    handleInput = (event) => {
        if (event.target.value == "" && this.props.focus) this.stopTyping()
        this.setState({ value : event.target.value })
    }


    handleKeypress = (event) => { 
        if (this.props.focus) {
            clearTimeout(this.typingTimeout)
            this.typingTimeout = setTimeout(_  => this.stopTyping(), 5000)
            //send "stopped typing" after 5 seconds of inactivity
            if (event.key == "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (this.props.focus.room_id) {
                    this.stopTyping()
                    let parsed = this.reader.parse(this.state.value)
                    let rendered = this.writer.render(parsed)
                    this.props.client.sendMessage(this.props.focus.room_id,{ 
                        body : this.state.value,
                        type :"m.text",
                        format: "org.matrix.custom.html",
                        formatted_body : rendered
                    })
                    this.setState({ value : "" })
                } else {
                    window.alert("you need to focus an annotation to send a message")
                }
            } else if (!this.typingLock) this.startTyping() 
        }
    }

    startTyping = () => {
        //send a "typing" notification with a 30 second timeout
        this.props.client.sendTyping(this.props.focus.room_id,true, 30000)
        //lock sending further typing notifications 
        this.typingLock = true
        //Release lock (to allow sending another typing notification) after 10 seconds
        this.resetLockTimeout = setTimeout(_  => { this.typingLock = false }, 10000)
    }

    stopTyping = () => {
        //return to "waiting for typing" state
        this.typingLock = false;
        clearTimeout(this.resetLockTimeout)
        clearTimeout(this.typingTimeout)
        //send a "not typing" notification
        this.props.client.sendTyping(this.props.focus.room_id,false) 
    }

    tryLoad = (room) => {
        var anchor = document.getElementById("scroll-anchor")
        var chatPanel = document.getElementById("chat-panel")
        if (anchor && chatPanel.getBoundingClientRect().top - 5 < anchor.getBoundingClientRect().top) {
            this.props.client.scrollback(room)
            var oldState = room.getLiveTimeline().getState(sdk.EventTimeline.BACKWARDS)
            if (!oldState.paginationToken) { 
                this.scrolledIdents.add(this.props.focus.room_id)
                this.setState({ fullyScrolled : true }) 
            }
            setTimeout(_ => this.tryLoad(room),100)
        }
    }

    tryLoadRoom = async () => {
        const room = await this.props.client.joinRoom(this.props.focus.room_id)
        this.tryLoad(room)
    }

    async componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevProps.focus != this.props.focus) {
            const room = await this.props.client.joinRoom(this.props.focus.room_id)
            this.setState({ 
                fullyScrolled : this.scrolledIdents.has(this.props.focus.room_id),
                events : room.getLiveTimeline().getEvents(),
            }, _ => this.tryLoad(room))
        }
    }

    render(props, state) {
        var reactions = {}
        const messages = state.events.filter(e => e.getContent().type == "m.text")
        const messagedivs = messages.map(event => <Message reactions={reactions} client={this.props.client} event={event}/>)
        //sort reactions by event reacted-to
        state.events.forEach(e => { if (e.getType() == "m.reaction") {
            if (reactions[e.getContent()["m.relates_to"].event_id]) reactions[e.getContent()["m.relates_to"].event_id].push(e) 
            else reactions[e.getContent()["m.relates_to"].event_id] = [e]
        }})
        return (
            <div id="chat-panel" onscroll={this.tryLoadRoom}>
                <textarea value={state.value} onkeypress={this.handleKeypress} oninput={this.handleInput}/>
                <div id="messages">
                {messagedivs} 
                <TypingIndicator client={this.props.client} typing={this.state.typing}/>
                </div>
                <Anchor focus={props.focus} fullyScrolled={state.fullyScrolled}/>
            </div>
        )
    }
}

class Anchor extends Component {
    render(props) {
        if (props.fullyScrolled) return <div>All events loaded</div>
        else if (!props.focus) return <div>Click an annotation to discuss</div>
        else return <div id="scroll-anchor">loading...</div>
    }
}

class TypingIndicator extends Component {
    render(props,state) {
        const shortids = props.typing.map(typer => typer.split(':')[0].slice(1))
        const howMany = shortids.length
        if (howMany == 0) {
            return <div class="typingIndicator">&nbsp;</div>
        } else if (howMany == 1) {
            return <div class="typingIndicator">{shortids[0]} is typing</div>
        } else if (howMany == 2) {
            return <div class="typingIndicator">{shortids[0]} and {shortids[1]} are typing</div>
        } else {
            return <div class="typingIndicator">several people are typing</div>
        }
    }
}

class Message extends Component {

    upvote = () => {
        let reactions = this.props.reactions[this.props.event.getId()] || []
        if (reactions.some(react => react.getSender() == this.props.client.getUserId() )) return
        //we bail out if there's already a plus one from me.
        this.props.client.sendEvent(this.props.event.getRoomId(), "m.reaction", {
            "m.relates_to" : {
                rel_type : "m.annotation",
                event_id : this.props.event.getId(),
                key : "👍"
            }
        })
    }

    render(props,state) {
        const event = props.event
        const shortid = event.getSender().split(':')[0].slice(1)
        const upvotes = props.reactions[event.getId()] 
                      ? props.reactions[event.getId()].length
                      : false
        const displayBody = (event.getContent().format == "org.matrix.custom.html")
            ? <div class="body" dangerouslySetInnerHTML={{__html : event.getContent().formatted_body}}/>
                          : <div class="body">{event.getContent().body}</div>
        if (props.client.getUserId() == event.getSender()) {
            return (
                <div id={event.getId()} class="message me">
                    {displayBody}
                    <span class="name">{shortid}</span>
                    {upvotes && <span class="upvotes">+{upvotes}</span>}
                </div>
            )
        } else {
            return (
                <div id={event.getId()} class="message">
                    <span class="name">{shortid}</span>
                    {upvotes && <span class="upvotes">+{upvotes}</span>}
                    {displayBody}
                    <button class="reaction" onclick={this.upvote}>+1</button>
                </div>
            )
        }
    }
}
