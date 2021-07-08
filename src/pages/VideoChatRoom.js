import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useHistory } from 'react-router-dom'
import Peer from 'peerjs'
import { useSelector, useDispatch } from 'react-redux'
import { setParticipants } from '../actions/index'
import styled from 'styled-components'
import ChatRoomNav from '../components/ChatRoomNav'
import ClosedRoomRedirctModal from '../components/modals/ClosedRoomRedirctModal'

const ChatRoom = styled.div`
  width: 100vw;
  height: 100vh;
  background-color: #262524;

  #video-grid {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;

    //임시 CSS
    video {
      height: auto;
      object-fit: cover;
      box-sizing: border-box;
    }
  }
`

export default function VideoChatRoom() {
  // Global
  const state = useSelector(state => state.logInStatusReducer) 
  const dispatch = useDispatch() 
  const { user, chatroom } = state //roomId(str), participants(array)

  // Local
  const [cameraOn, setCameraOn] = useState(true)
  const [roomClosed, setRoomClosed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const roomId = window.location.pathname.slice(6) //chatroom.roomId
  const username = user.isLogedIn? user.username : `GUEST${Math.round(Math.random()*100000)}`
  const userId = user.userId
  let myStream = null
  let myPeerId = ''

  const videoGrid = useRef()
  const myVideo = useRef()
  const history = useHistory()
  
  const handleCamera = () => {
    setCameraOn(prev => !prev)
    if ( cameraOn ) {
      myStream.getTracks().forEach(track => {
        track.stop()
      })

    } else if ( !cameraOn ) {
      navigator.mediaDevices.getUserMedia({video: true})
      .then (stream => {
        addVideoStream(myVideo.current, stream)
        videoGrid.current.append(myVideo.current)
      })
    }
  }

  useEffect(() => {
    const socket = io(process.env.REACT_APP_IO)
    const peer = new Peer()

    
    // 클라의 영상 스트림 비디오에 넣기
    navigator.mediaDevices.getUserMedia({video: true})
    .then(stream => {
      myStream = stream
      addVideoStream(myVideo.current, stream)
      videoGrid.current.append(myVideo.current)
      setIsLoading(false)
      
      // 피어 생성하기
      
      peer.on('open', peerId => {
        //소켓을 통해 서버로 방ID, 유저ID 보내주기
        myPeerId = peerId
        socket.emit('join-room', roomId, peerId, userId, username)

        //전역변수 chatroom.participants에 본인 더하기
        dispatch(setParticipants( peerId, username ))
      })

      // 새로운 피어가 연결을 원할 때
      peer.on('call', mediaConnection => {
        //answer()를 해야 mediaConnection이 활성화됨
        mediaConnection.answer(stream)
        const newVideo = document.createElement('video')
        
        mediaConnection.on('stream', newStream => {
          addVideoStream(newVideo, newStream)
          videoGrid.current.append(newVideo)
        })

        mediaConnection.on('close', () => {
          socket.emit('camera-off', myPeerId, username)
        })
      })

      socket.on('user-connected', (peerId, username) => {
        const mediaConnection = peer.call(peerId, stream)
        const newVideo = document.createElement('video')
        newVideo.setAttribute('id', `${peerId}`)

        mediaConnection.on('stream', newStream => {
          addVideoStream(newVideo, newStream)
          videoGrid.current.append(newVideo)
        })
        
        //작동함
        console.log(`새로운 유저가 접속했습니다! 유저이름: ${username} / 유저ID: ${peerId}`)
      })
    })

    socket.on('user-camera-off', (peerId, username) => {
      const video = document.getElementById(`${peerId}`)
      console.log(`유저 카메라 꺼짐: ${video}`)
      
    })

    socket.on('user-camera-on', (peerId, username) => {
      const video = document.getElementById(`${peerId}`)
      console.log(`유저 카메라 켜짐: ${video}`)
    })

    socket.on('user-disconnected', (peerId, username) => {
      const video = document.getElementById(`${peerId}`)
      console.log(video)
      if (video !== null) {
        video.remove()
      } else {
        setRoomClosed(true)
      }
      console.log(`유저 나갔다. 나간놈 이름: ${username}`)
    })

    // 테스팅 필요
    return function cleanup() {
      myStream.getTracks().forEach(track => {
        track.stop()
      })
      socket.disconnect()
        peer.destroy()
    }

  }, [])

  return (
    <>
      <ChatRoomNav cameraOn={cameraOn} handleCamera={handleCamera}/>
      <ChatRoom>
        { isLoading && <span>Loading...</span> }
        <div ref={videoGrid} id="video-grid">
          <video ref={myVideo}></video>
        </div>
        
      </ChatRoom>
      {
        roomClosed && <ClosedRoomRedirctModal />
      }
    </>
  )
}

// 영상 스트림을 DOM 비디오 엘리먼트에 넣어주는 함수
function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}


