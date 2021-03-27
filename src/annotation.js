import { h, render, createRef, Fragment, Component } from 'preact';
import * as Layout from "./layout.js"
import * as Matrix from "matrix-js-sdk"
import { eventVersion }  from "./constants.js"

export default class AnnotationLayer extends Component {
    constructor(props) {
        super(props)
        this.state = { focus : null }
        props.client.on("RoomState.events", event => {
            //Important that it be "this.props", so that it tracks the changing props of the component
            if (event.event.room_id == this.props.roomId && event.event.type == eventVersion) {
                this.forceUpdate()
            }
        }) 
        window.addEventListener('keydown', e => { if (e.key == "D") this.closeFocus(); })
        //TODO: remove listeners on unmount
    }

    filterAnnotations (event) {
        return (
            event.event.content.pageNumber == this.props.page 
            && event.event.content.activityStatus != "closed"
        )
    }

    setFocus = content => this.setState({focus : content})

    closeFocus = _ => {
        this.props.client.sendStateEvent(this.props.roomId, eventVersion, {
            "uuid": this.state.focus.uuid, 
            "clientRects": this.state.focus.clientRects,
            "activityStatus": "closed"
        }, this.state.focus.uuid)
    }

    render(props,state) {
        //just to get started
        const theRoom = props.client.getRoom(props.roomId)
        const uuid = state.focus ? state.focus.uuid : null
        var annotations = []
        if (theRoom) { 
            const theRoomState = theRoom.getLiveTimeline().getState(Matrix.EventTimeline.FORWARDS)
            annotations = theRoomState.getStateEvents(eventVersion)
                                      .filter(event => this.filterAnnotations(event))
                                      .map(event => <Annotation focused={uuid == event.event.content.uuid}
                                                                setFocus={this.setFocus} 
                                                                event={event}/>)
        }
        return (
            <div ref={props.deepref} id="annotation-layer">
                {annotations}
            </div>
        )
    }
}

class Annotation extends Component {

    constructor(props) {
        super(props)
    }

    setFocus = _ => this.props.setFocus(this.props.event.event.content)

    render(props,state) {
        const uuid = props.event.event.content.uuid
        const spans = JSON.parse(props.event.event.content.clientRects)
                          .map(rect => (<RectSpan setFocus={this.setFocus} rect={rect}/>))
        return <div data-focused={props.focused} id={uuid}>{spans}</div>
    }
}

class RectSpan extends Component {

    ref = createRef()

    componentDidMount() { Layout.positionRelativeAt(this.props.rect,this.ref.current) }

    componentDidUpdate() { Layout.positionRelativeAt(this.props.rect,this.ref.current) }

    render(props,state) {
        return <span onclick={props.setFocus} data-annotation ref={this.ref}></span>
    }
}
