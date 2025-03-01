'use strict'

    let qParams = new URL( document.URL ).searchParams
    var bgtype = "";
    var mediaRecorder;
    var recordedChunks = [];
    var downloadLink = document.createElement("a")
    var serverURL;
    var offerId;
    var canvas;
    var ctx;
    if(qParams.has("bgtype")) { 
      bgtype = qParams.get("bgtype")
    }

    /*****************************************************************/
    /*                  Miscellaneous utility functions              */

    /*****************************************************************/

    /**
     * fetch a value from a form field, or
     * from a URL parameter with the same name
     * @param name
     * @returns {*} null or value
     */
    function getField( name ) {
      const fname = document.getElementById( name )
      let val
      if( fname ) {
        const isCheckbox = fname.matches( '[type="checkbox"]' )
        if( isCheckbox ) {
          // we need to respect if checkbox is true or false, not just true
          // also need to see if it was on url. so just be very explicit about them
          // it appears precedence should be url > UI. we really should populate UI from URL and just use UI here.
          let urlVal = getURLParameter( name )
          if (urlVal && urlVal.length > 0) {
            val = urlVal
            fname.checked = !!urlVal
          }
          else
            val = fname.checked

          return val
        }
        else
          val = fname.value

        if( val === true || (val && val.length > 0) )
          return val
        else {
          val = getURLParameter( name )
          if( val && val.length > 0 ) {
              fname.value = val
          }
        }
      }
      return getURLParameter( name )
    }

    function setField( name, val ) {
      const fname = document.getElementById( name )
      if( fname ) {
        const isCheckbox = fname.matches( '[type="checkbox"]' )
        if( isCheckbox ) fname.checked = !!val
        else fname.value = val
      }
    }

    /* aliases to allow URL parameters to be shorter */
    const parameterAliases = {
      chromestyle: 'c',
      bandwidth: 'b',
      framerate: 'f',
      resolution: 'r',
      sessionkey: 'k',
      username: 'u',
      password: 'pw',
      groupid: 'g',
      partneruserid: 'puid',
      loginkey: 'l',
      maincid: 'c',
      isAnonymous: 'a',
      telephone: 't',
      start: 's',
      poster: 'p',
      videoBackEnabled: 'vb'
    }

    function getURLParameter( name ) {
      const params = new URL( document.URL ).searchParams
      if( params.has( name ) ) return params.get( name )
      /* not found, try aliases */
      if( name in parameterAliases ) {
        let aliases = parameterAliases[name]
        if( typeof aliases === 'string' ) aliases = [aliases]
        for( let i = 0; i < aliases.length; i++ ) {
          const alias = aliases[i]
          if( params.has( alias ) ) return params.get( alias )
        }
      }
      return null
    }

    /**
     * Get a random string value, with uppercase, lowercase, and numeric characters
     * This excludes lower-case L. upper-case O, zero, and one to make values more readable.
     * Each character is chosen by a roll from among 58 random values
     * @param length
     * @returns {string}
     */
    function stringNonce( length ) {
      var array = new Uint32Array( 1 )
      var chars = 'abcdefghijkmnopqrstuvwxyz23456789ABCDEFGHIJKLMNPQRSTUVWXYZ'
      var nonce = []
      var getRnd
      if( window.crypto && typeof window.crypto.getRandomValues === 'function' ) {
        getRnd = function() {
          window.crypto.getRandomValues( array )
          return array[0] % 58
        }
      }
      else {
        getRnd = function() {
          return Math.floor( 58 * Math.random() )
        }
      }
      for( let n = length; n > 0; n -= 1 ) {
        nonce.push( chars[getRnd()] )
      }
      return nonce.join( '' )
    }

    function numericNonce( length ) {
      let nonce = ''
      for( let n = length; n > 0; n -= 1 ) {
        let rnd = Math.floor( 1000.0 * Math.random() ).toString()
        rnd = rnd.substring( rnd.length - 1 )
        nonce += rnd
      }
      return nonce.substring( 0, length )
    }

    const addListeners = ( agentVideoObject ) => {
      agentVideoObject.addEventListener( 'previewStarted', (( videoElement, options ) => {
        console.log( 'preview started' )
      }) )
      agentVideoObject.addEventListener( 'previewStopped', (( videoElement, options ) => {
        console.log( 'preview stopped' )
      }) )
      agentVideoObject.addEventListener( 'sessionStarted', (options => {
        // Retrieve video duration
        //const urlParams = new URLSearchParams(window.location.search);
        //let videoUrl = urlParams.get("videomockurl");
        /*if(videoUrl) {
          if(videoUrl.lastIndexOf("_") > 0) {
            try {
            let duration = videoUrl.substring(videoUrl.lastIndexOf("_") + 1).split(".")[0];
            options.descriptor.streamid += "$$$" + duration + "000";
            } catch(e) {
              console.log("wrong video url");
            }
          }
        }*/
        setPlayerlink( playerlink, options )
        playerlink.style.display = 'initial'
        setField( 'streamName', options.descriptor.streamid )
        setField( 'sessionkey', options.descriptor.passcode )
        offerId = options.descriptor.streamid
      }) )
      agentVideoObject.addEventListener( 'sessionEnded', (options => {
        if( playerlink ) playerlink.style.display = 'none'
        if( startButton ) startButton.disabled = false
        if( stopButton ) stopButton.disabled = true

        let link = document.getElementById("download")
        console.log("end");
        if(!link) {
          if(mediaRecorder.state == "recording") {
            console.log("mediaRecorder.state = " + mediaRecorder.state);
            mediaRecorder.stop();
          }

          setTimeout( () => {
            console.log(recordedChunks.length)
            let blob = new Blob(recordedChunks, { type: 'video/webm' })
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = 'capture.webm';
            document.body.insertBefore(downloadLink, document.body.firstChild);

            // Upload the recording to the server
            if(serverURL) {
              const formData = new FormData();
              formData.append('filename', offerId + '_preview')
              formData.append('video', blob);
              fetch(serverURL, {
                  method: 'POST',
                  body: formData
                  })
                  .then(response => { console.log('upload success');})
              .catch(error => {console.error('upload error');})
            }
          }, 3000);
        }


        console.log( 'endSession event' )
      }) )
      agentVideoObject.addEventListener( 'error', (( err, options ) => {
        let explanation = ''
        if( err && err.status && err.status < 500 && err.status >= 400 ) {
          const statusText = err.statusText || ''
          switch ( err.status ) {
            case 403:
              explanation = 'You probably need to log in to Glance to use this service.'
              break
          }
          explanation = `Error ${err.status}(${statusText}) on ${options.vserver}. ${explanation}`
          console.log( explanation )
        }
        else {
          explanation = (typeof err === 'string')
            ? err
            : 'Unknown error ' + typeof err + ' ' + JSON.stringify( err )
        }
        if( errormessage ) {
          errormessage.innerText = explanation
          errormessage.style.display = 'initial'
        }
        else {
          console.error( 'error event', err, options )
        }
        if( startButton ) startButton.disabled = false
        if( stopButton ) stopButton.disabled = true
      }) )
      agentVideoObject.addEventListener( 'guestCountChanged', (( count, options ) => {
        console.log( 'guest count:', count )
        // If it is the mock video scenario we need to play it on guest connect
        if(count > 0) {
          let video = document.getElementById("glance_video_mock");
          let previewVideo = document.getElementById("agentvideo");

          const options = {
            audioBitsPerSecond: 0,
            videoBitsPerSecond: 1500000,
            mimeType: 'video/webm; codecs="avc1.42E01E"'
          }

          downloadLink.mimetype = "application/octet-stream";
          downloadLink.id = 'download';
          downloadLink.innerHTML = "download recording";
          var stream = previewVideo.captureStream();
          mediaRecorder = new MediaRecorder(stream, options);

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunks.push(e.data);
            }
          };

          if(video && video.paused) {
              video.play();
              video.onended = endSession;
          } else if(previewVideo) {
              // in case if we want to record camera stream at preview
              previewVideo.play();
              previewVideo.onended = endSession;
          }
          mediaRecorder.start();
        }
      }))

      agentVideoObject.addEventListener( 'info', (( info, options ) => {
        console.log( 'info event', info )
        const logElement = document.getElementById( 'logdata' )
        if( logElement ) {
          logElement.innerHTML = logElement.innerHTML + '<br />' + info
        }
      }) )

      /* update the torch on/off UI */
      agentVideoObject.addEventListener( 'torch', (( available ) => {
        if( torchbutton ) {
          if( available ) {
            /* this source camera has a torch, do a UI thing */
            const litText = torchbutton.getAttribute( 'lit-text' ) || 'Off'
            const unlitText = torchbutton.getAttribute( 'unlit-text' ) || 'On'
            const lit = agentVideoObject.getTorch()
            torchbutton.innerText = lit ? litText : unlitText
            torchbutton.classList.remove( 'invisible' )
            torchbutton.onclick = ( event ) => {
              const willLight = !agentVideoObject.getTorch()
              agentVideoObject.setTorch( willLight )
              torchbutton.innerText = willLight ? litText : unlitText
            }
          }
          else {
            torchbutton.innerText = ''
            torchbutton.classList.add( 'invisible' )
            torchbutton.onclick = null
          }
        }
      }) )
    }

    /*****************************************************************/
    /* handle chrome customization (chrome:
     *  the stuff in the window around the video
     * from &chromestyle=whatever|whatelse|something parameter
     * any stylesheets with class chromestyle are considerd.
     * any stylesheets with class chromestyle-whatever (mentioned in the list above)
     * are enabled.
     * the rest aree disabled.
     */
    const chromeStyleSheets = document.querySelectorAll( 'style.chromestyle' )
    const styles = getField( 'chromestyle' )
    if( typeof styles === 'string' ) {
      const styleSet = new Set()
      styles.split( /[|;,]/ ).forEach( name => styleSet.add( 'chromestyle-' + name.trim() ) )
      chromeStyleSheets.forEach( css => {
        let result = false
        css.classList.forEach( item => {
          if( styleSet.has( item ) ) result = true
        } )
        css.disabled = !result
      } )
    }
    else chromeStyleSheets.forEach( css => css.disabled = true )

    /*****************************************************************/
    const previewVideoElement = document.getElementById( 'agentvideo' )
    const startButton = document.getElementById( 'start' )
    const stopButton = document.getElementById( 'stop' )
    const reconnectButton = document.getElementById( 'reconnect' )
    if( reconnectButton )
      reconnectButton.style.display = 'block'
    const inviteButton = document.getElementById( 'invite' )
    const playerlink = document.getElementById( 'playerlink' )
    const errormessage = document.getElementById( 'errormessage' )
    const playerparams = document.getElementById( 'playerparams' )
    const torchbutton = document.getElementById( 'torch' )

    let width = 352
    let height = 288
    /* get the resolution from a parameter if it's present. res=WxH */
    const resolutionParam = getURLParameter( 'res' )
    if( resolutionParam ) {
      const dims = resolutionParam.split( 'x' )
      if( dims.length === 2 ) {
        const w = parseInt( dims[0], 10 )
        const h = parseInt( dims[1], 10 )
        if( w && w >= 160 && h && h >= 120 ) {
          width = w
          height = h
        }
      }
    }
    else if( previewVideoElement ) {
      /* get the resolution from the size of the video tag */
      width = previewVideoElement.scrollWidth
      height = previewVideoElement.scrollHeight
    }

    function getVserver() {
      const urlParams = new URLSearchParams(window.location.search);
      let loadBalancer = urlParams.get("loadbalancer")
      let vserver = window.location.hostname + ":25101";
      switch(window.location.hostname) {
        case "dw1.myglance.org":
        case "dw2.myglance.org":
        case "dw3.myglance.org":
        case "dw4.myglance.org":
          vserver = loadBalancer == 'true' ? "dev-video-a-1.myglance.org" : "video.myglance.org";
          break;
        case "qa.myglance.org":
          vserver = loadBalancer == 'true' ? "lb-qa-video.myglance.org" : "qa-video.myglance.org";
          break;
        case "www.myglance.net":
          vserver = loadBalancer == 'true' ? "lb-video.myglance.net" : "video.myglance.net";
          break;
        case "www.glance.net":
          vserver = loadBalancer == 'true' ? "lb-video.glance.net" : "video.glance.net";
          break;
        case "www-bofa.myglance.net":
          vserver = "bofa-staging-video-a-1.myglance.net";
          break;
      }
      return vserver;
    }

    const options = {
      vserver: "https://" + getVserver() + "/",
      mime: 'video/webm; codecs="avc1.42E01E"',
      stopPreviewsOnSessionEnd: false,
      screenshare: false,
    }

    options.width = width
    options.height = height
    let sender

    // blur = false means it even will not load BGEeffects.js file
    const blurParam = getURLParameter('blur')
    if ( blurParam ) {
      options.bgBlur = blurParam == 'true'
      if(blurParam) {
        // Hide radio buttons of blur=false
        document.getElementById("tracking_algorithm").style.display = "none";
      }
    } else {
      options.bgBlur = true     // default to true for this sample page
    }

    /* get the segmentation option */
    const segmentationModelParam = getURLParameter( 'segmentationModel' )
    if ( segmentationModelParam ) {
      options.segmentationModel = segmentationModelParam
    }

    /* get the screenshare option 'true' or false */
    const screenshareParam = getURLParameter( 'screenshare' )
    if ( screenshareParam ) {
      options.screenshare = screenshareParam == 'true'
    }
    else
      options.screenshare = false

    let videoSourceDevice

    const start = async function start( videoElement ) {

      await GLANCE.Video.GlanceVideoSource.isAgentVideoCapable()
      console.log( 'video good to go' )

      const fieldNames = ['bandwidth', 'framerate', 'sessionkey', 'username', 'password', 'groupid', 'partneruserid', 'loginkey', 'maincid', 'maincallid', 'isAnonymous', 'telephone', 'videoBackEnabled']
      for( let i = 0; i < fieldNames.length; i++ ) {
        const q = getField( fieldNames[i] )
        if( q !== null && q !== '' ) options[fieldNames[i]] = q
      }
      options.deviceName = getURLParameter( 'devicename' )
      
      // pick up mask resize logic after reload on image and color cases

      if(!bgtype) {
        options.bgType = "";
        options.bgBlur = false;
      } else {
        options.bgBlur = true;
        if(bgtype == "image") {
          options.bgType = bgtype;
          options.bgImageURL = getURLParameter('environment') + "/video/sampleagent/images/video-bgd-1280x720.png";
        } else if(bgtype == "fill") {
          options.bgType = bgtype;
          options.bgColor = '#2E9CDD'
        }
      } 

      sender = new GLANCE.Video.VideoSource( options )
      addListeners( sender )
      if( getField( 'start' ) ) {
        sender.addEventListener( 'initialized', autostart )
      }

      //console.log( sender.getOptions(), sender )

      function chooseCamera( event ) {
        /* the source's deviceId is an attribute of the clicked object */
        const deviceId = event.currentTarget.getAttribute( 'deviceId' )
        sender.setSource( deviceId )
        .then()
        .catch( (err => console.error( err )) )
      }

      let videoSourceDevice = null
      /* only call getSourcesAsync() if there's a camera=something queryparam
       * this lets us test the use case where we don't call getSourcesAsync()
       * before initialize()
       * This was the failure in GD-14347
       */
      const camera = getField( 'camera' )
      if( camera && typeof camera === 'string' && camera.length > 0 ) {
        const sources = await sender.getSourcesAsync()
        /* fill in a menu for the source devices if it is available */
        if( cameraList && sources && sources.length > 0 ) {
          sources.forEach( source => {
            const li = document.createElement( 'li' )
            li.id = source.name
            li.innerText = source.name
            li.onclick = chooseCamera
            li.classList.add( 'choice' )
            li.setAttribute( 'deviceId', source.deviceId )
            cameraList.appendChild( li )
          } )
        }
        let index = Number( camera )
        if( isNaN( index ) || index >= sources.length ) {
          if( sources ) {
            sources.map( source => {
              if(
                (typeof source === 'string' && source.includes( camera )) ||
                (source && source.name && typeof source.name === 'string' && source.name.includes( camera )) &&
                (source && source.label && typeof source.label === 'string' && source.label.includes( camera ))
              ) {
                videoSourceDevice = source
              }
            } )
          }
        }
        else {
          videoSourceDevice = sources[index]
        }
      }
      // Replace camera stream with a mock stream if there is a query parameter
      const urlParams = new URLSearchParams(window.location.search);
      serverURL = urlParams.get("videostorageurl");
      if(urlParams.get("videomockurl")) {
        navigator.mediaDevices.getUserMedia = async function(constraints) {
          //const urlParams = new URLSearchParams(window.location.search);
          let videoUrl = urlParams.get("videomockurl");
          let video = document.getElementById("glance_video_mock");
          if(video == null) {
            video = document.createElement("video")
            video.style.display = "none";
            video.setAttribute("id", "glance_video_mock");
            video.setAttribute("src", videoUrl);
            video.setAttribute("crossorigin", "anonymous");
            video.autoplay = true;
            video.muted = true;
            //this.videoMockElement = video;
            document.body.appendChild(video);
          } else {
            video.play();
          }
          return new Promise( ( resolve, reject ) => {
            video.oncanplay = () => {
              let stream = video.captureStream();
              let track = stream.getVideoTracks()[0];
              
              if(window.MediaStreamTrackProcessor) {
                if(!canvas) {
                  canvas = document.createElement("canvas");
                  canvas.width = constraints.video.width;
                  canvas.height = constraints.video.height;
                  ctx = canvas.getContext("2d");
                }
                  
                const processor = new MediaStreamTrackProcessor(track);
                const reader = processor.readable.getReader();
                readChunk();

                function readChunk() {
                  reader.read().then( ({ done, value }) => {
                    ctx.clearRect( 0, 0, canvas.width, canvas.height);
                    try {
                      ctx.drawImage( value, 0, 0, canvas.width, canvas.height);
                      value.close();
                    } catch(e) {
                      console.log(e)
                    }
                    if(!done) {
                      readChunk();
                    }
                  });
                }
                resolve(canvas.captureStream(constraints.video.frameRate));
              } else {
                resolve(video.captureStream());
              }
              video.pause();
            };
          }); 
        }
      }

      await sender.initialize( videoSourceDevice, videoElement )
      console.log( 'back from initialize' )
      return sender
    }

    const setPlayerlink = ( link, options ) => {
      if( link && options && options.descriptor && options.descriptor.url ) {
        let params = getField( 'playerparams' ) || ''
        params = (params && typeof params === 'string' && params.length > 0) ? '&' + params : ''
        link.href = `${document.location.origin}/videotestpages/VideoRecorder.aspx?offer=${options.descriptor.url}${params}`
        
        let versionParams = "&version=" + getURLParameter('version');
        if(versionParams.indexOf("M") > 0) {
          versionParams = versionParams.substring(0, versionParams.length - 1) + "&min=true"
        }
        link.href = link.href + versionParams;
      }
    }

    start( previewVideoElement )
    .then( senderObject => {
      sender = senderObject
    } )
    .catch( error => {
      console.log( error )
    } )

    /**
     * gets called just once if &start=1 parameter is provided.
     */
    function autostart() {
      sender.removeEventListener( 'initialized', autostart )
      startSession()
    }

    /**
     * click event handler to start a session
     * @returns {boolean} false, to avoid posting the form
     */
    function startSession() {
      const options = {}
      const fieldNames =
        ['sessionkey',
          'username',
          'password',
          'partnerid',
          'groupid',
          'partneruserid',
          'loginkey',
          'maincid',
          'isAnonymous',
          'videoBackEnabled']
      for( let i = 0; i < fieldNames.length; i++ ) {
        const q = getField( fieldNames[i] )
        if( q !== null && q !== '' ) options[fieldNames[i]] = q
      }
      if( !options.sessionkey && !options.isAnonymous ) {
        options.sessionkey = stringNonce( 6 )
        setField( 'sessionkey', options.sessionkey )
      }

      if( startButton ) startButton.disabled = true
      if( stopButton ) stopButton.disabled = false
      if( reconnectButton ) reconnectButton.disabled = false

      options.vserver = "https://" + getVserver() + "/";
      sender.setOptions( options )
      sender.startSession()

      if( errormessage ) {
        errormessage.innerText = ''
        errormessage.style.display = 'none'
      }
      return false
    }

    /**
     * click event handler to send an sms message to the number in id="telephone"
     * @returns {boolean} fakse to avoid posting the form
     */
    function inviteSMS() {
      const options = {}
      const fieldNames =
        ['sessionkey',
          'bandwidth',
          'framerate',
          'resolution',
          'partnerid',
          'groupid',
          'maincid',
          'isAnonymous',
          'start',
          'videoBackEnabled']
      for( let i = 0; i < fieldNames.length; i++ ) {
        const q = getField( fieldNames[i] )
        if( q !== null && q !== '' ) options[fieldNames[i]] = q
      }
      options.isAnonymous = true
      if( !options.sessionkey && !options.isAnonymous ) {
        options.sessionkey = stringNonce( 6 )
        setField( 'sessionkey', options.sessionkey )
      }
      /* figure out host to use */
      const host = window.location.host.split( '.' )
      const server = host.shift()
      if( /^[a-z][0-9]+$/.test( server ) ) host.unshift( 'video' )
      else host.unshift( server )
      const startUrl = new URL( 'https://' + host.join( '.' ) + window.location.pathname )
      /* create URL with abbreviated parameters */
      const startParams = startUrl.searchParams
      if( options.sessionkey ) startParams.append( 'k', options.sessionkey )
      startParams.append( 'b', options.bandwidth || '250kbps' )
      startParams.append( 'f', options.framerate || '10' )
      startParams.append( 'r', options.resolution || '352x288' )
      if( options.isAnonymous ) startParams.append( 'a', 1 )
      if( options.groupId || options.partnerid ) startParams.append( 'g', options.groupId || options.partnerid )
      if( options.maincid ) startParams.append( 'c', options.maincid )
      if( options.start ) startParams.append( 's', 1 )

      const notifyUrl = new URL( window.location.href )
      if( notifyUrl.hostname.startsWith( 'my' ) ) notifyUrl.port = 3000
      notifyUrl.pathname = '/notify/sms'
      notifyUrl.search = ''
      const notifyParams = new URLSearchParams()
      notifyParams.append( 'to', getField( 'telephone' ) )
      notifyParams.append( 'body', startUrl.toString() )

      const fetchOpts = {
        method: 'POST',
        cache: 'no-cache',
        credentials: 'include',
        cors: 'cors',
        body: notifyParams.toString(),
        headers: new Headers( {
          'Accept': 'application/json',
          'Content-type': 'application/x-www-form-urlencoded'
        } ),
      }
      fetch( notifyUrl.toString(), fetchOpts )
      .then( response => {
        return response.json()
      } )
      .then( response => {
        if( !response.ok ) console.log( 'bad sms response', response )
      } )
      .catch( error => {
        console.error( server, error )
      } )
      return false
    }

    /**
     * click event handler to stop a session
     * @returns {boolean} false to avoid posting the form
     */
    function endSession() {
      if( startButton ) startButton.disabled = false
      if( stopButton ) stopButton.disabled = true
      if( reconnectButton ) reconnectButton.disabled = false
      sender.endSession()
      return false
    }

    function reconnectSession() {
      if( startButton ) startButton.disabled = true
      if( stopButton ) stopButton.disabled = false

      sender.reconnectSession()
    }

    startButton.onclick = startSession
    stopButton.onclick = endSession
    if( inviteButton ) inviteButton.onclick = inviteSMS
    if( reconnectButton )
      reconnectButton.onclick = reconnectSession;

    function findElement( hyperpath ) {
      if( !hyperpath ) return null
      const paths = hyperpath.split( '@' )
      let currentElement = document
      for( let i = 0; i < paths.length; i++ ) {
        let nextElement = currentElement.querySelector( paths[i] )
        if( !nextElement ) return null
        if( nextElement.tagName.toUpperCase() === 'IFRAME' ) {
          nextElement = nextElement.contentDocument || nextElement.contentWindow.document
        }
        currentElement = nextElement
      }
      return currentElement
    }

    function findByPath( element, loc ) {
      if( !element ) return null
      loc = loc || 'data-preview-path'
      const path = element.getAttribute( loc )
      return findElement( path )
    }

    const showPreviewButton = document.getElementById( 'previewShow' )
    const hidePreviewButton = document.getElementById( 'previewHide' )
    const refreshPreviewButton = document.getElementById( 'previewRefresh' )
    const iframeElement = document.getElementById( 'preview' )
    const cameraList = document.getElementById( 'cameralist' )

    if( refreshPreviewButton && iframeElement ) {
      refreshPreviewButton.onclick = function refreshPreview( event ) {
        iframeElement.contentWindow.location.reload( true )
        return false
      }
    }

    if( showPreviewButton ) {
      showPreviewButton.onclick = function showPreview( event ) {
        const container = findByPath( event.srcElement )
        if( container ) {
          container.style.display = 'initial'
          let videoElement
          if( container.tagName.toUpperCase() !== 'VIDEO' ) {
            videoElement = document.createElement( 'video', { controls: false, autoplay: false } )
            container.appendChild( videoElement )
          }
          else {
            videoElement = container
          }
          sender.startPreview( videoElement )

          showPreviewButton.disabled = true
          hidePreviewButton.disabled = false
        }
        return false
      }
    }
    if( hidePreviewButton ) {
      hidePreviewButton.onclick = function hidePreview( event ) {
        const container = findByPath( event.srcElement )
        if( container ) {
          container.style.display = 'none'
          if( container.tagName.toUpperCase() !== 'VIDEO' ) {
            for( let i = 0; i < container.children.length; i++ ) {
              const element = container.children[i]
              if( element.tagName.toUpperCase() === 'VIDEO' ) {
                sender.stopPreview( element )
                container.removeChild( element )
              }
            }
            showPreviewButton.disabled = false
            hidePreviewButton.disabled = true
          }
        }
        return false
      }
    }
    const togglePreviewButton = document.getElementById( 'previewToggle' )
    let which
    if( togglePreviewButton ) {
      togglePreviewButton.onclick = function togglePreview( event ) {
        const v1 = findByPath( event.srcElement, 'data-preview-path1' )
        const v2 = findByPath( event.srcElement, 'data-preview-path2' )
        const before = which
        if( which === v1 ) which = v2
        else which = v1
        sender.startPreview( which )
        if( before && before.stopPreview ) before.stopPreview()
        return false
      }
    }

    const stopAllPreviewButton = document.getElementById( 'previewStopAll' )
    if( stopAllPreviewButton ) {
      stopAllPreviewButton.onclick = function stopAllPreview( event ) {
        sender.stopAllPreviews()
        return false
      }
    }

    let drawTrackingDataCheckbox = document.getElementById('drawTrackingData');
    drawTrackingDataCheckbox.checked = false;
    drawTrackingDataCheckbox.addEventListener('change', () => {
        GLANCE.Video.drawTrackingData = drawTrackingDataCheckbox.checked;
    });

    let noEffectRadioButton = document.getElementById('noEffect');
    noEffectRadioButton.checked = !bgtype;
    noEffectRadioButton.addEventListener('change', () => {
      if (noEffectRadioButton.value) {
        replaceBgType("");
      }
    });

    let blurRadioButton = document.getElementById('blurEffect');
    blurRadioButton.checked = bgtype && bgtype == "blur";
    blurRadioButton.addEventListener('change', () => {
      if (blurRadioButton.value) {
        replaceBgType("blur");
      }
    });
    let colorFillRadioButton = document.getElementById('colorFillEffect');
    colorFillRadioButton.checked = bgtype && bgtype == "fill";
    colorFillRadioButton.addEventListener('change', () => {
        if (colorFillRadioButton.value) {
          replaceBgType("fill");
        }
    });
    let imageFillRadioButton = document.getElementById('imageFillEffect');
    imageFillRadioButton.checked = bgtype && bgtype == "image";
    imageFillRadioButton.addEventListener('change', () => {
      if (imageFillRadioButton.value) {
        replaceBgType("image");
      }
    });

    function replaceBgType(newtype) {
      let url = new URL(window.location.href)
      url.searchParams.set("bgtype", newtype);
      window.location.href = url;
    }
