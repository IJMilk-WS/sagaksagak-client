import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Peer from "peerjs";
import { useSelector, useDispatch } from "react-redux";
import { setUser, setDeleteUser } from "../actions/index";
import styled from "styled-components";
import ChatRoomNav from "../components/ChatRoomNav";
import ClosedRoomRedirctModal from "../components/modals/ClosedRoomRedirctModal";
import ChatroomTodo from "../components/ChatroomTodo";

const ChatRoom = styled.div`
  width: 100vw;
  height: 100vh;
  background-color: #262524;

  #video-grid {
    box-sizing: border-box;
    width: 100%;
    height: 100vh;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    overflow: hidden;

    video {
      width: ${(props) => {
        switch (props.numberOfUsers) {
          case 1:
            return `100vh`;
          case 2:
            return `46%`;
          case 3:
            return `30%`;
          case 4:
            return `46%`;
          case 5:
            return `30%`;
          case 6:
            return `30%`;
          default:
            return `100%`;
        }
      }};
      height: ${(props) => {
        switch (props.numberOfUsers) {
          case 1:
            return `auto`;
          case 2:
            return `45vh`;
          case 3:
            return `45vh`;
          case 4:
            return `45vh`;
          case 5:
            return `45vh`;
          case 6:
            return `45vh`;
          default:
            return `100%`;
        }
      }};
      object-fit: cover;
    }
  }
`;

export default function VideoChatRoom() {
  // Global
  const state = useSelector((state) => state.logInStatusReducer);
  const dispatch = useDispatch();
  const { user, participants } = state; //roomId(str), participants(array)

  // Local
  const [cameraOn, setCameraOn] = useState(true);
  const [roomClosed, setRoomClosed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState(1);
  const roomId = window.location.pathname.slice(6); //chatroom.roomId
  const username = user.isLogedIn
    ? user.username
    : `GUEST${Math.round(Math.random() * 100000)}`;
  const userId = user.userId;

  let myStream = null;
  let myPeerId = "";
  let allStream = useRef();

  const videoGrid = useRef();
  const myVideo = useRef();

  // TODO
  const [todoOpen, setTodoOpen] = useState(false);

  const handleCamera = () => {
    setCameraOn((prev) => !prev);
    if (cameraOn) {
      let video = allStream.current.getTracks();
      video[0].enabled = false;
    } else {
      let video = allStream.current.getTracks();
      video[0].enabled = true;
    }
  };

  const toggleTodo = () => {
    setTodoOpen(!todoOpen);
  };

  useEffect(() => {
    const socket = io(process.env.REACT_APP_IO);
    const peer = new Peer();

    // ????????? ?????? ????????? ???????????? ??????
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      let streamId = stream.id;
      myStream = stream;
      addVideoStream(myVideo.current, stream);
      videoGrid.current.append(myVideo.current);
      setIsLoading(false);
      allStream.current = stream;

      // ?????? ????????????

      peer.on("open", (peerId) => {
        //????????? ?????? ????????? ???ID, ??????ID ????????????
        myPeerId = peerId;
        socket.emit("join-room", roomId, peerId, userId, username, streamId);

        //???????????? chatroom.participants??? ?????? ?????????
        dispatch(setUser(peerId, username, streamId));
      });

      // ????????? ????????? ????????? ?????? ???
      peer.on("call", (mediaConnection) => {
        //answer()??? ?????? mediaConnection??? ????????????
        mediaConnection.answer(stream);
        const newVideo = document.createElement("video");
        newVideo.setAttribute("autoplay", "playsinline");

        mediaConnection.on("stream", (newStream) => {
          addVideoStream(newVideo, newStream);
          videoGrid.current.append(newVideo);
          setUsers(videoGrid.current.childElementCount);
        });

        mediaConnection.on("close", () => {
          socket.emit("camera-off", myPeerId, username);
        });
      });

      socket.on("user-connected", (peerId, username, streamId) => {
        dispatch(setUser(peerId, username, streamId));
        setUsers((prev) => prev + 1);
        const mediaConnection = peer.call(peerId, stream);
        const newVideo = document.createElement("video");
        // newVideo.setAttribute("id", `${peerId}`);

        mediaConnection.on("stream", (newStream) => {
          addVideoStream(newVideo, newStream);
          videoGrid.current.append(newVideo);
          setUsers(videoGrid.current.childElementCount);
        });
      });
    });

    socket.on("user-disconnected", (peerId, username, streamId) => {
      dispatch(setDeleteUser(peerId));
      setUsers((prev) => prev - 1);
      const video = document.querySelectorAll("video");
      let removeVideo;
      for (let i = 0; i < video.length; i++) {
        if (video[i].srcObject.id === streamId) {
          removeVideo = video[i];
        }
      }

      removeVideo.remove();
    });

    // ????????? ??????
    return function cleanup() {
      myStream.getTracks().forEach((track) => {
        track.stop();
      });
      socket.disconnect();
      peer.destroy();
    };
  }, []);

  return (
    <>
      <ChatRoomNav
        cameraOn={cameraOn}
        handleCamera={handleCamera}
        toggleTodo={toggleTodo}
      />
      <ChatRoom numberOfUsers={users}>
        {isLoading && <span>Loading...</span>}
        <div ref={videoGrid} id="video-grid">
          <video ref={myVideo} autoPlay playsInline></video>
        </div>
      </ChatRoom>
      {roomClosed && <ClosedRoomRedirctModal />}
      {todoOpen && <ChatroomTodo toggleTodo={toggleTodo} />}
    </>
  );
}

// ?????? ???????????? DOM ????????? ??????????????? ???????????? ??????
function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
}
