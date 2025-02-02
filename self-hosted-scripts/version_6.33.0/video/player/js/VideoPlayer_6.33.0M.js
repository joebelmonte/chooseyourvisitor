/* simple browser Javascript for Glance visitor video */

/*
 * URL parameters:
 *    offer=https://vserverHostName/offer/offerNonce  required
 *    guestid=nnnnn identity of guest (a number)
 *    gpu=0  0 means suppress use of WebGL for rendering. Omit or 1 means choose according to browser capabilities
 *    chaostime=n   if provided, player reloads in a random time between 0 and n seconds.
 *    noendpage=1   if provided, player does not move to end page when the session ends.
 */
if( !window.GLANCE ) window.GLANCE = {}
GLANCE.ViewerEndPage = '/ViewerEnd.asp'
GLANCE.RedirectDelay = 250
GLANCE.IsResponsive = true
GLANCE.ResizeDebounce = 250
GLANCE.LoadingPopupDelay = 2500
GLANCE.StoppedPopupDelay = 1000

GLANCE.VideoDebug = true
GLANCE.LogVideoTelemetry = false

document.addEventListener(
  'DOMContentLoaded',
  function GLANCEvideoDOMLoaded() {

    var videoTag = document.querySelector( 'div#container div.videocontainer' )
    var loadingPopup = document.getElementById( 'loading' )
    var stoppedPopup = document.getElementById( 'stopped' )
    var scalingMethod = 0 /* 0 default  1=clip   2=fit 3=box (letterbox or postbox)  4=topbox */
    var videoWidth = -1
    var videoHeight = -1
    var decodedWidth = -1
    var decodedHeight = -1

    var getURLParameter = function getURLParameter( name ) {
      return decodeURIComponent(
        (new RegExp( '[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)' ).exec( location.search ) || [null, ''])[1].replace(
          /\+/g, '%20' ) ) || null
    }

    /**
     * Get the guestid parameter, either from the url or a persistent random value
     * @returns {Number} the guest id
     */
    var getGuestID = function getGuestID() {
      var guestId = Number( getURLParameter( 'guestid' ) )
      if( !guestId || isNaN( guestId ) ) {
        try {
          /* GD-17884 CheckMarx alerts on browser storage vulnerability */
          guestId = Number( sessionStorage.getItem( 'guestid' ) )
          if( isNaN( guestId ) ) guestId = null
        }
        catch ( e ) {
          guestId = null
        }
        if( !guestId || isNaN( guestId ) ) {
          /* random positive 32-bit int */
          guestId = Number( (2147483647 - 1000) * Math.random() + 1000 )
        }
      }
      try {
        if( guestId ) sessionStorage.setItem( 'guestid', guestId )
        else sessionStorage.removeItem( 'guestid' )
      }
      catch ( e ) {
        /* empty, intentionally */
      }
      return guestId
    }

    function Start( offer, extra ) {
      if( offer && offer.length > 0 ) {
        player.start( offer, videoTag, GLANCE.IsResponsive, extra )
      }
      else {
        console.error( 'no video session provided' )
        viewerEnd( 1, 'video player did not connect to server' )
      }
    }

    /**
     * need this because ViewerEnd expects some messages to have spaces encoded with the old-timey +
     * @param str
     * @returns {string}
     */
    function encodeUriComponentWithPlus( str ) {
      var res = encodeURIComponent( str )
      return res.replace( /%20/gi, '+' )
    }

    /**
     * viewerEnd
     * redirect to /ViewerEnd.asp
     * @param err   0 or 1
     * @param msg   message
     * @param sessionInfo  relay object
     */
    var sessionEnding = 0

    /**
     * sanitize user-furnished hostname per GD-17884
     * @param {string} host  something.whatever.net
     * @param {string} def default for trash hostname
     * @param {string} prefix first level domain name
     * @returns {string}  www.whatever.net
     */
    function getWwwHostname( host, def = 'glance.net', prefix = 'www' ) {
      const sanRe = new RegExp( /^[A-Za-z0-9][.A-Za-z0-9]+[A-Za-z0-9]$/ )
      if( host.match( sanRe ) ) {
        host = host.split( '.' ).splice( 1 ).join( '.' )
      }
      else host = def
      return prefix + '.' + host
    }

    /**
     * handle end of viewer session
     * @param err
     * @param msg
     * @param sessionInfo
     */
    function viewerEnd( err, msg, sessionInfo ) {
      player.clearPopups()
      if( sessionEnding === 0 ) {
        var prm = []
        prm.push( 'err=' + err )
        prm.push( 'msg=' + encodeUriComponentWithPlus( msg ) )
        var host = getWwwHostname(window.location.hostname)

        if( sessionInfo ) {
          prm.push( 'vn=' + sessionInfo.connectionSerial )
          prm.push( 'ver=' + sessionInfo.playerVersion || 'video' )
          if( sessionInfo.session ) {
            var session = sessionInfo.session
            host = session.host
            if( session.personid )
              prm.push( 'sn=' + session.personid + '.' + (session.passcode || '') + '.' + (session.disambiguateid || '') )
          }
        }
        var viewerEndURL = 'https://' + host + GLANCE.ViewerEndPage + '?' + prm.join( '&' )
        var noendpage = getURLParameter( 'noendpage' )
        if( !noendpage ) {
          if( GLANCE.RedirectDelay > 0 ) {
            sessionEnding = setTimeout( function( target ) {
              window.location = target
            }, GLANCE.RedirectDelay, viewerEndURL )
          }
          else {
            console.error( 'Redirect to ' + viewerEndURL + ' suppressed for debugging' )
          }
        }
      }
    }

    /**
     * upon seeing the chaostime=secs parameter,
     * refresh randomly, to try to mess up the data stream
     */
    (function chaosMonkey() {
      if( !GLANCE ) GLANCE = {}
      var chaosTime = getURLParameter( 'chaostime' )
      if( chaosTime ) {
        var randTime = Math.random() * 1000 * chaosTime
        console.error( 'Chaos reload', randTime.toFixed( 0 ) )
        setTimeout( function() {
          if( !GLANCE.StopChaos ) window.location.reload()
        }, randTime )
      }
    })()

    var player = new GLANCE.Video()
    GLANCE.VideoPlayer = player

    /**
     * postContainerMessage
     * Post a message to the window parent, if any, for backward compatibility with the AJAX viewer
     * (or post to a container like embedded Edge. )
     * @param {Object<>} payload
     */
    function postContainerMessage( payload ) {
      if( window.parent !== window ) {
        window.parent.postMessage( {
            'glance_viewer': payload
          }
          , '*' )
      }
    }

    /* if we're in an iFrame, post messages to parent window per 11885 and 12790 */
    /* screen size change message */
    player.addEventListener( 'screen', function( payload, sessionInfo ) {
      /* See GD-17884. The whitebox screen casting application
       * depends on seeing this URL in the message,
       * so it cannot be sanitized or redacted
       * without the possibility of disrupting their app. */
      payload.url = new URL(document.location).toString()
      payload.key = sessionInfo.session.passcode
      payload.device = {
        modelId: sessionInfo.session.modelId || '',
        localizedName: sessionInfo.session.localizedName || ''
      }
      postContainerMessage( payload )
    } )
    /* statistics */
    player.addEventListener( 'stats', function( payload, sessionInfo ) {
      /* See GD-17884. The whitebox screen casting application
       * depends on seeing this URL in the message,
       * so it cannot be sanitized or redacted
       * without the possibility of disrupting their app. */
      payload.url = new URL(document.location).toString()
      payload.key = sessionInfo.session.passcode
      payload.device = {
        modelId: sessionInfo.session.modelId || '',
        localizedName: sessionInfo.session.localizedName || ''
      }
      postContainerMessage( payload )
    } )
    /* end */
    player.addEventListener( 'end', function( frameCount, sessionInfo ) {
      /* See GD-17884. The whitebox screen casting application
       * depends on seeing this URL in the message,
       * so it cannot be sanitized or redacted
       * without the possibility of disrupting their app. */
      const url = new URL(document.location).toString()
      var payload = {
        closed: true,
        url,
        key: sessionInfo.session.passcode,
        device: {
          modelId: sessionInfo.session.modelId || '',
          localizedName: sessionInfo.session.localizedName || ''
        }
      }
      postContainerMessage( payload )
      viewerEnd( 0, 'Close, reason: 0', sessionInfo )
    } )
    /* log incoming messages */
    player.addEventListener( 'log', function log( message ) {
      if( GLANCE.VideoDebug ) {
        if (!GLANCE.LogVideoTelemetry && message.startsWith('T {"client"'))
          return
        console.log( 'log', message )
      }

    } )

    /* If we are being closed because we can't keep up, tell our container */
    player.addEventListener( 'tooSlow', function( ) {
      let payload = {
        closereason: 'PlayerTooSlow'
      }
      postContainerMessage( payload )
    } )

    if( loadingPopup || stoppedPopup ) {
      var popupDelay = GLANCE.LoadingPopupDelay
      var stopDelay = GLANCE.StoppedPopupDelay
      var popupTimeout = -1
      var popupVisible = false
      var stopupVisible = false
      var stopped = false

      player.clearPopups = function clearPopups() {
        if( popupTimeout !== -1 ) clearTimeout( popupTimeout )
        player.removeEventListener( 'start', startpopdown )
        player.removeEventListener( 'progress', popdown )
        player.removeEventListener( 'stop', endpopdown )
        player.removeEventListener( 'end', endpopdown )
        if( stopupVisible ) stoppedPopup.classList.remove( 'visible' )
        if( popupVisible ) loadingPopup.classList.remove( 'visible' )
        popupTimeout = -1
        popupVisible = false
        stopupVisible = false
      }

      var firePopup = function firePopup() {
        GLANCE.VideoDebug && GLANCE.Send( 'Info notice popdown fired' )
        if( !popupVisible ) loadingPopup.classList.add( 'visible' )
        popupVisible = true
        popupTimeout = -1
      }

      var fireStopup = function fireStopup() {
        GLANCE.VideoDebug && GLANCE.Send( 'Info notice endpopdown fired' )
        if( !stopupVisible ) stoppedPopup.classList.add( 'visible' )
        if( popupVisible ) loadingPopup.classList.remove( 'visible' )
        stopupVisible = true
        popupVisible = false
        popupTimeout = -1
      }

      var popdown = function popdown() {
        if( stopped ) return
        if( popupVisible ) loadingPopup.classList.remove( 'visible' )
        if( stopupVisible ) stoppedPopup.classList.remove( 'visible' )
        popupVisible = false
        stopupVisible = false

        if( popupTimeout !== -1 ) clearTimeout( popupTimeout )
        popupTimeout = setTimeout( firePopup, popupDelay )
      }

      var startpopdown = function startpopdown() {
        stopped = false
        popdown()
      }

      var endpopdown = function endpopdown() {
        stopped = true
        if( popupTimeout !== -1 ) clearTimeout( popupTimeout )
        popupTimeout = setTimeout( fireStopup, stopDelay )
      }
      /* start event comes at beginning of session. */
      player.addEventListener( 'start', startpopdown )
      /* progress event comes when a frame gets rendered. */
      player.addEventListener( 'progress', popdown )
      /* stopping message from source. */
      player.addEventListener( 'stop', endpopdown )
      /* Closing message from source. */
      player.addEventListener( 'end', endpopdown )
    }

    player.addEventListener( 'codec', function( message ) {
      GLANCE.VideoDebug && console.log( 'video codec', message )
      var streamformat = document.getElementById( 'streamformat' )
      if( streamformat ) {
        streamformat.textContent = mime
      }
    } )

    player.addEventListener( 'guestCountChanged', function( guestCount, sessionInfo ) {
      GLANCE.VideoDebug && console.log( 'guest count', guestCount )
      var guestsdiv = document.getElementById( 'guestcount' )
      if( guestsdiv ) {
        guestsdiv.textContent = guestCount
      }
    } )

    player.addEventListener( 'rates', function( rates, sessionInfo ) {
      var mbps = 0.000001 * rates.averageBitrate
      var msg = rates.width + 'x' + rates.height +
        ' ' + mbps.toFixed( 2 ) + ' mbits/s ' +
        ' ' + rates.averageFramerate.toFixed( 1 ) + ' frames/s' +
        ' ' + rates.averagePacketrate.toFixed( 1 ) + ' packets/s'
      GLANCE.VideoDebug && console.log( msg )
      var ratesdiv = document.getElementById( 'rates' )
      if( ratesdiv ) {
        ratesdiv.textContent = msg
      }
    } )

    player.addEventListener( 'format', function( message ) {
      GLANCE.VideoDebug && console.log( 'video format', message )
      var coderparams = document.getElementById( 'coderparams' )
      if( coderparams ) {
        coderparams.textContent = message
      }
    } )

    player.addEventListener( 'warning', function( message ) {
      GLANCE.VideoDebug && console.log( 'WARNING;', message )
    } )

    player.addEventListener( 'error', function( message, sessionInfo ) {
      GLANCE.VideoDebug && console.log( 'error', message )
      viewerEnd( 1, message, sessionInfo )
    } )

    player.addEventListener( 'screen', function( sizes ) {
      /* announcing video source material dimensions or changes in dimensions */
      var sourceWidth = sizes.screen.width
      var sourceHeight = sizes.screen.height
      if( videoWidth !== sourceWidth || videoHeight !== sourceHeight ) {
        videoWidth = sourceWidth
        videoHeight = sourceHeight
        decodedWidth = sizes.screen.width
        decodedHeight = sizes.screen.height
        resizeWindow()
      }
    } )

    window.addEventListener( 'message', function( message) {
      // check that message origin domain matches that of this player page
      // (domain extract from here - https://stackoverflow.com/a/65968074/63069
      // seems to work really well, handles things like co.uk, etc.
      const messageDomain =  message.origin.match(/^(?:.*?\.)?([a-zA-Z0-9\-_]{3,}\.(?:\w{2,8}|\w{2,4}\.\w{2,4}))$/)[1];
      const thisDomain = this.location.origin.match(/^(?:.*?\.)?([a-zA-Z0-9\-_]{3,}\.(?:\w{2,8}|\w{2,4}\.\w{2,4}))$/)[1];
      if (messageDomain === thisDomain) {
        if (message.data.glance && message.data.command && message.data.command == 'sendpassthrough') {
          // pass message.data to agent via passthrough message
          GLANCE.Send( 'Passthrough sendpassthrough ' + message.data.messagetype + ' ' + JSON.stringify(message.data.messagedata) )
        }
      }
      else if (message.data.glance) {
        console.log('error - glance message received from mismatched domain ' + messageDomain)
      }
    })

    var offerUrl = getURLParameter( 'offer' )

    /*  We have a scaling= URL parameter.
     *  Why? to control the user experience when the aspect ratio of the video window
     *       is different from the aspect ratio of the received video.
     *       (That's almost always.)
     *   scaling=clip    means clip the video at the top / bottom or left/right
     *                         so it fills the video window.
     *   scaling=fit     means stretch the video to fill the window. This can be ugly.
     *   scaling=box     means shrink the video to fill the window,
     *                         leaving space at the top and bottom (letterboxing)
     *                         or at the left and right (postboxing)
     *   scaling=topbox  means the same as box, except that letterboxing is
     *                         modified. All the space appears at the bottom.
     *   scaling=default means box when the video window is < 200 high
     *                         and topbox otherwise.
     *
     *  gpu=0 gives us a way explicitly to DISABLE gpu rendering in the player.
     *  Why do we need this?
     *    When we use the player to render to an iOS device, embedded in
     *    an iOS app, when we use the gpu the video renders visually correctly.
     *    But the video content isn't available to the screen-sharing setup
     *    to grab the screen contents and send it via a Glance G session to
     *    an agent. The result is a simple white screen instead of the video
     *    as displayed to the agent.
     *
     *   gpu=0 has a side-effect: it also causes clip scaling rather than
     *      letterbox or fit (stretch) scaling.
     *    The scaling sideffect can be overridden by using the scaling=clip, scaling=fit,
     *       scaling=box, or scaling=topbox parameter, with or without the gpu parameter.
     */
    var gpu = getURLParameter( 'gpu' ) || 1
    gpu = fixNum( gpu )
    if( gpu % 2 === 0 ) scalingMethod = 1
    var scaling = getURLParameter( 'scaling' )
    if( scaling ) {
      /* scaling == number instead of scaling === number is intentional */
      if( scaling == 2 || scaling === 'fit' ) scalingMethod = 2
      else if( scaling == 1 || scaling === 'clip' ) scalingMethod = 1
      else if( scaling == 3 || scaling === 'box' ) scalingMethod = 3
      else if( scaling == 4 || scaling === 'topbox' ) scalingMethod = 4
      else if( scaling == 0 || scaling === 'default' ) scalingMethod = 3
    }
    if( scalingMethod === 2 ) videoTag.classList.add( 'scale-to-fit' )
    else if( scalingMethod === 1 ) videoTag.classList.add( 'scale-clip' )
    else if( scalingMethod === 0 || scalingMethod === 3 ) videoTag.classList.add( 'scale-box' )
    else if( scalingMethod === 4 ) videoTag.classList.add( 'scale-topbox' )
    var guestid = getGuestID()
    var conntype = getURLParameter( 'conntype' )

    Start( offerUrl, { guestid: guestid, conntype: conntype, gpu: gpu } )
    var resizeTimeout

    /**
     * actually resize window after debouncing etc
     */
    function resizeWindow() {
      resizeTimeout = null
      var canvasTag = videoTag.querySelector( 'canvas' )
      if (!canvasTag){
        canvasTag = videoTag.querySelector( 'video' )
      }
      if( !canvasTag ) return
      var canvasStyle = canvasTag.style
      var rect = videoTag.getBoundingClientRect()

      var tWidth = rect.width
      var tHeight = rect.height
      var offset = 0
      var dAspect
      var vAspect
      if( scalingMethod !== 2) {
        if( videoHeight <= 0 || rect.height <= 0 ) {
          /* bogus height values, don't do anything */
          GLANCE.VideoDebug && console.log( 'incorrect heights: source', videoHeight, 'viewport', rect.height )
          return
        }
        dAspect = decodedWidth / decodedHeight
        vAspect = rect.width / rect.height
        if( scalingMethod === 1 ) {
          if ((dAspect < 1.0) && (vAspect > 1.0)){ /* portrait video square scale-clip */
            tWidth = rect.height
            tHeight = tWidth / dAspect
            var xOffset = Math.round( (rect.width - tWidth) * 0.5 )
            var yOffset = Math.round( (rect.height - tHeight) * 0.5 )
            canvasStyle.left = xOffset + 'px'
            canvasStyle.top = yOffset + 'px'
          }else if( dAspect > vAspect ) { /* scale-clip */
            /* decoded video aspect wider than viewport aspect, clip sides */
            tWidth = tHeight * dAspect
            offset = Math.round( (rect.width - tWidth) * 0.5 )
            canvasStyle.top = 0 + 'px'
            canvasStyle.left = offset + 'px'
          }
          else {
            /* decoded video aspect narrower than viewport aspect, clip top and bottom */
            tHeight = tWidth / dAspect
            offset = Math.round( (rect.height - tHeight) * 0.5 )
            canvasStyle.left = 0 + 'px'
            canvasStyle.top = offset + 'px'
          }
        }
        else if( (scalingMethod === 0 && tHeight > 220) || scalingMethod === 4 ) {
          /* topbox: for letterbox, put all the extra space at the bottom
           *  rather than centering. Force this for scaling=default (0) (the default) this if the
           *  height of the window is >= 220  GD-15365    */
          if( dAspect > vAspect ) {
            /* letterbox: decoded video aspect wider than viewport aspect, render at the top  */
            canvasStyle.marginTop = 0
          }
          else {
            /* postbox: decoded video aspect narrower than viewport aspect, default letterbox */
            /* empty, intentionally */
          }
        }
      }
      canvasTag.setAttribute('data-srcHeight', decodedHeight);
      canvasTag.setAttribute('data-srcWidth', decodedWidth);
      player.resize( Math.round( tWidth ), Math.round( tHeight ) )
    }

    function resizeEvent() {
      if( resizeTimeout ) window.clearTimeout( resizeTimeout )
      resizeTimeout = window.setTimeout( resizeWindow, GLANCE.ResizeDebounce || 250 )
    }

    window.addEventListener( 'resize', resizeEvent )
  } )

/* polyfills for Redmond Middle School science projects */
if( !Math.trunc ) {
  Math.trunc = function( v ) {
    v = +v
    if( !isFinite( v ) ) return v
    return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0)
  }
}

/**
 * take any value and coerce it to a number
 * @param n
 * @returns {number}
 */
function fixNum( n ) {
  return Number( Number( n ).toFixed( 0 ) )
}
