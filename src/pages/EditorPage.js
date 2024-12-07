import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
import Editor from '../components/Editor';
import axios from 'axios';
import { initSocket } from '../socket';
import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from 'react-router-dom';

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef('');
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState('javascript');
  const [inputArgs, setInputArgs] = useState('');
  const [outputValue, setOutputValue] = useState('');

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on('connect_error', (err) => handleErrors(err));
      socketRef.current.on('connect_failed', (err) => handleErrors(err));

      function handleErrors(e) {
        console.log('socket error', e);
        toast.error('Socket connection failed, try again later.');
        reactNavigator('/');
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(ACTIONS.LANGUAGE_CHANGED, (newLanguage) => {
        setLanguage(newLanguage);
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
            console.log(`${username} joined`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
    };
    init();
    return () => {
      socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.LANGUAGE_CHANGED);
    };
  }, []);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID has been copied to your clipboard');
    } catch (err) {
      toast.error('Could not copy the Room ID');
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator('/');
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const handleLanguageChange = (e) => {
    const selectedLanguage = e.target.value;
    setLanguage(selectedLanguage); // Update local state
    socketRef.current.emit(ACTIONS.LANGUAGE_CHANGED, {
      roomId,
      language: selectedLanguage,
    }); // Broadcast the language change
  };

  async function handleRun(e) {
    const endpoint = 'https://emkc.org/api/v2/piston/execute';
    const languageVersions = {
      cpp: '10.2.0',
      c: '10.2.0',
      python: '3.10.0',
      javascript: '1.32.3',
      java: '15.0.2',
    };

    const version = languageVersions[language] || 'default';
    const formattedInput = inputArgs.trim().replace(/\n/g, ' ');
    const modifiedContent = codeRef.current.trim();
    const requestData = {
      language,
      version,
      files: [
        {
          content: modifiedContent,
        },
      ],
      stdin: formattedInput,
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: -1,
      run_memory_limit: -1,
    };

    try {
      const response = await axios.post(endpoint, requestData);
      console.log(response.data);
      const stdout = response.data?.run?.stdout || response.data?.run?.stderr;
      setOutputValue(stdout);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/image.png" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        <button className="btn runBtn" onClick={handleRun}>
          Run
        </button>
        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>
      <div className="editorWrap">
        {/* Header Section */}
        <div className="header">
          <label htmlFor="language">Language: </label>
          <select
            id="language"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>

        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
      </div>
      <div className="newSection">
        {/* Input Field */}
        <div className="field">
          <label htmlFor="inputField">Input:</label>
          <textarea
            id="inputField"
            placeholder="Enter your input here"
            rows="5"
            className="textarea"
            value={inputArgs}
            onChange={(e) => setInputArgs(e.target.value)}
          ></textarea>
        </div>
        {/* Output Field */}
        <div className="field">
          <label htmlFor="outputField">Output:</label>
          <textarea
            id="outputField"
            placeholder="Program output will appear here"
            rows="5"
            className="textarea"
            value={outputValue}
            readOnly
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
