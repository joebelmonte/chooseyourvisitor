/*


usage:

p = new Player({
  useWorker: true | false | "auto" // defaults to "auto",
  workerFile: <defaults to "Decoder.js"> // give path to Decoder.js
  webgl: true | false | "auto" // defaults to "auto"
  targetScalable:  true | false // allow target display to be scalable, defaults to false
  size: {
            width: targetWidth,
            height: targetHeight
  }

});

// canvas property represents the canvas node
// put it somewhere in the dom
p.canvas;

p.webgl; // contains the used rendering mode. if you pass 'auto' to webgl you can see what auto detection resulted in

// We can pass a Javascript timestamp if we have one.
// The infos
var infos = {timestamp:ts};
p.decode(<binary>, infos);  // infos is optional

*/

// universal module definition
(function( root, factory ) {
  if( typeof define === 'function' && define.amd ) {
    // AMD. Register as an anonymous module.
    define( ['./Decoder', './YUVCanvas'], factory );
  } else if( typeof exports === 'object' ) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory( require( './Decoder' ), require( './YUVCanvas' ) );
  } else {
    // Browser globals (root is window)
    root.Player = factory( root.Decoder, root.YUVCanvas );
  }
}( this, function( Decoder, WebGLCanvas ) {
  'use strict';

  var nowValue = Decoder.nowValue;

  var Player = function( parOptions ) {
    var self     = this;
    this._config = parOptions || {};

    this.render = true;
    if( this._config.render === false ) {
      this.render = false;
    }

    this.nowValue = nowValue;

    this._config.workerFile = this._config.workerFile || 'Decoder.js';
    console.log("Worker url : " + this._config.workerFile)
    if( this._config.preserveDrawingBuffer ) {
      this._config.contextOptions                       = this._config.contextOptions || {};
      this._config.contextOptions.preserveDrawingBuffer = true;
    }

    var webglOpt  = this._config.webgl;
    var webgl     = false;
    var haveWebgl = true;
    try {
      if( !window.WebGLRenderingContext ) {
        /* browser lacks WebGL */
        haveWebgl = false;
      } else {
        /* speculative webgl setup */
        var canvas = document.createElement( 'canvas' );
        canvas.classList.add('videorender')

        var ctx    = canvas.getContext( 'webgl' );
        /* internet explorer 11
         * cannot handle viewport setting to fix right black bar
         * || canvas.getContext("experimental-webgl") */
        if( !ctx ) {
          /* browser supports WebGL but initialization failed */
          haveWebgl = false;
        }
        ctx    = null;
        canvas = null;
      }
    }
    catch ( e ) {
      console.error("Error on webGL check" + e.message);
      haveWebgl = false;
    }
    if( haveWebgl && (webglOpt === 'auto' || webglOpt === true) ) webgl = true;
    else if( !haveWebgl && webglOpt === false ) webgl = false;
    else {
      /* announce inability to honor webgl request, and fall back */
      console.log( 'broadway WebGL unavailable' );
      webgl = false;
    }
    this.webgl = webgl;

    // choose functions
    if( this.webgl ) {
      this.createCanvasObj = this.createCanvasWebGL;
      this.renderFrame     = this.renderFrameWebGL;
    }
    else {
      this.createCanvasObj = this.createCanvasRGB;
      this.renderFrame     = this.renderFrameRGB;
    }

    var lastWidth;
    var lastHeight;
    var onPictureDecoded = function( buffer, width, height, infosArray ) {

      self.onPictureDecoded( buffer, width, height, infosArray );

      var startTime = nowValue();
      var infos     = {};
      if( infosArray && infosArray[0] ) infos = infosArray[0];
      if( !buffer || !self.render ) {
        return;
      }

      infos.sourceWidth    = this.sourceWidth || infos.sourceWidth || width;
      infos.sourceHeight   = this.sourceHeight || infos.sourceHeight || height;
      infos.targetWidth    = this.targetWidth || infos.targetWidth || width;
      infos.targetHeight   = this.targetHeight || infos.targetHeight || height;
      infos.decodedWidth   = this.decodedWidth || width;
      infos.decodedHeight  = this.decodedHeight || height;
      infos.targetScalable = this.targetScalable;
      infos.webgl          = this.webgl;

      var doRender = true;
      if( self.onRenderFramePrepare && typeof self.onRenderFramePrepare === 'function' ) {
        doRender = self.onRenderFramePrepare( {
          data:      buffer,
          width:     width,
          height:    height,
          infos:     infos,
          canvasObj: self.canvasObj
        } );
      }

      if( doRender ) {
        self.renderFrame( {
          canvasObj: self.canvasObj,
          data:      buffer,
          width:     width,
          height:    height,
          infos:     infos
        } );
      }

      if( self.onRenderFrameComplete && typeof self.onRenderFrameComplete === 'function' ) {
        self.onRenderFrameComplete( {
          data:      buffer,
          width:     width,
          height:    height,
          infos:     infos,
          canvasObj: self.canvasObj
        } );
      }

    };

    // provide size
    if( !this._config.size ) this._config.size = {};
    this._config.size.width  = Math.round( this._config.size.width ) || 200;
    this._config.size.height = Math.round( this._config.size.height ) || 200;

    this.targetWidth    = this._config.size.width;
    this.targetHeight   = this._config.size.height;
    this.targetScalable = this._config.targetScalable || false;
    
    if(this._config.useWorker) {
	  // Convert js to blob to avoit cross-origin worker situation
      // Adding a parameter to script URL to avoid Safari wired caching behavior
      let mills = new Date().getTime();
      console.log("Fetching worker at : " + this._config.workerFile + "?time=" + mills);
      fetch(this._config.workerFile + "?time=" + mills)
      .then(response => {
        if(response.status === 200) {
          return response.blob();
        }
      }).then(blob => {
        let workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);

        this.worker.recycle = function recycle( data ) {
          if( self._config.reuseMemory )
          self.worker.postMessage( { reuse: data.buf }, [data.buf] ); // Return buff data to our worker.
        };
        this.worker.addEventListener( 'message', function fromDecoder( e ) {
          var data = e.data;
          if( data.consoleLog ) {
            console.log( data.consoleLog );
            return;
          }
          if( data.log && GLANCE && GLANCE.log ) {
            GLANCE.log.apply( null, data.log );
            return;
          }
          onPictureDecoded.call( self, new Uint8Array( data.buf ), data.width, data.height, data.infos );
          self.worker.recycle( data );
        }, false );
  
        this.worker.postMessage( {
          type: 'Broadway.js - Worker init', options: {
            rgb:         !webgl,
            memsize:     this.memsize,
            reuseMemory: this._config.reuseMemory ? true : false
          }
        } );
  
        if( this._config.transferMemory ) {
          this.decode = function( parData, parInfo ) {
            // no copy
            // instead we are transfering the ownership of the buffer
            // dangerous!!!
            this.worker.postMessage( {
              buf:      parData.buffer,
              offset:   parData.byteOffset,
              length:   parData.length,
              info:   parInfo
            }, [parData.buffer] ); // Send data to our worker.
          };
  
        }
        else {
          this.decode = function( parData, parInfo ) {
            // Copy the sample so that we only do a structured clone of the
            // region of interest
            var copyU8 = new Uint8Array( parData );
            this.worker.postMessage( {
              buf:      copyU8.buffer,
              offset:   0,
              length:   parData.length,
              info:   parInfo
            }, [copyU8.buffer] ); // Send data to our worker.
          };
        }
      }).catch( error => {
        console.warn('fetch URL' + this._config.workerFile + ' onerror called')
        console.warn('Message : ' + error.message)
      });
    }
    else {
      this.decoder = new Decoder( {
        rgb: !webgl
      } );
      this.decoder.onPictureDecoded = onPictureDecoded;

      this.decode = function( parData, parInfo ) {
        self.decoder.decode( parData, parInfo );
      };
    }


    if( this.render ) {
      this.domNode = null;
      if( this.canvasObj ) {
        this.canvasObj.canvas = null;
        this.canvasObj        = null;
      }
      this.canvasObj = this.createCanvasObj( {
        contextOptions: this._config.contextOptions
      } );
      this.canvas    = this.canvasObj.canvas;
    }

    this.domNode = this.canvas;

    lastWidth  = this._config.size.width;
    lastHeight = this._config.size.height;
  };

  /**
   * Compute descriptive stats on an unsigned byte array (an image transect)
   * @returns {{len: number, avg: number, std: number, mad: number, min: number, max: number}}
   */
  Uint8Array.prototype.stats = function stats() {
    var len = this.byteLength;
    if( len <= 0 ) return { len: 0, avg: 0, std: 0, mad: 0, min: 0, max: 0 };
    var sum   = 0.0;
    var sqsum = 0.0;
    var max   = Number.MIN_SAFE_INTEGER;
    var min   = Number.MAX_SAFE_INTEGER;
    var i;
    var item  = 0;
    for( i = 0; i < len; i++ ) {
      item = this[i];
      sum += item;
      sqsum += item * item;
      max  = item > max ? item : max;
      min  = item < min ? item : min;
    }
    var avg = sum / len;
    var std = Math.sqrt( (sqsum / len) - (avg * avg) );
    sum     = 0;
    for( i = 0; i < len; i++ ) sum += Math.abs( this[i] - avg );
    var mad = sum / len;
    return { len: len, avg: avg, std: std, mad: mad, min: min, max: max };
  };


  Player.prototype = {

    deletePlayer:        function() {
      this.domNode   = null;
      this.canvas    = null;
      this.canvasObj = null;
      if( this.worker && typeof this.worker.terminate === 'function' ) this.worker.terminate();
      this.worker = null;
    },
    /***
     * The video source can have slightly smaller dimensions than the encoded video stream.
     * If the user of Player knows them by out-of-band means, give them here.
     * @param object with width and height members
     */
    setSourceDimensions: function( p ) {
      this.sourceWidth  = Math.round( p.width );
      this.sourceHeight = Math.round( p.height );
    },

    /***
     * Retrieve the dimensions of the video source
     * (which may be slightly smaller than the decoded dimensions)
     * @returns {{width: *, height: *}}
     */
    getSourceDimensions: function() {
      return { width: this.sourceWidth, height: this.sourceHeight };
    },

    /***
     * when the output is responsive
     * (when targetScalable is true)
     * it's possible for the desired size
     * of the target canvas to change.
     * call this to change it for subsequent frames.
     * these values are ignored when targetScalable is false.
     * @param object with width and height members
     */
    setTargetDimensions: function( p ) {
      this.targetWidth  = Math.round( p.width );
      this.targetHeight = Math.round( p.height );
    },

    /***
     * Retrieve the dimensions of the canvas being drawn.
     * @returns {{width: *, height: *}}
     */
    getTargetDimensions: function() {
      return { width: this.targetWidth, height: this.targetHeight };
    },

    /**
     * Fetch a few consecutive pixels--a transect--from the present image
     * @param data
     * @param {string} component -- 'y', 'u', 'v', 'r', 'g', 'b'
     * @param {number} x -- where in the frame 0,1 or integer
     * @param {number} y -- where in the frame 0,1 or integer
     * @param {number} len -- number of consecutive pixels to return
     * @returns {Uint8Array} or null
     */
    getDecodedData: function getDecodedData( data, component, x, y, len ) {
      if( typeof Math.round !== 'function' ) return null;
      var decodedWidth  = data.infos.decodedWidth || 0;
      var decodedHeight = data.infos.decodedHeight || 0;
      if( decodedWidth === 0 || decodedHeight === 0 ) return null;

      len           = len || 1;
      var lenOffset = Math.round( len / 2 );

      switch ( component ) {
        /* unpacked yuv 422 format */
        case 'y':
        case 'u':
        case 'v':
          var lumalen      = decodedWidth * decodedHeight;
          var chromalen    = lumalen / 4;
          var lumarow      = decodedWidth;
          var chromarow    = decodedWidth / 2;
          var lumastart    = 0;
          var ustart       = lumastart + lumalen;
          var vstart       = ustart + chromalen;
          var chromaWidth  = decodedWidth / 2;
          var chromaHeight = decodedHeight / 2;

          switch ( component ) {
            case 'y':
            case 'luma':
              if( x < 1.0 ) x = Math.round( x * decodedWidth );
              if( y < 1.0 ) y = Math.round( y * decodedHeight );
              break;
            case 'u':
            case 'v':
              if( x < 1.0 ) x = Math.round( x * chromaWidth );
              if( y < 1.0 ) y = Math.round( y * chromaHeight );
              break;
          }

          var start = 0;

          switch ( component ) {
            case 'y':
            case 'luma':
              start = lumastart + (y * lumarow) + x - lenOffset;
              break;
            case 'u':
              start = ustart + (y * chromarow) + x - lenOffset;
              break;
            case 'v':
              start = vstart + (y * chromarow) + x - lenOffset;
              break;
            default:
              return null;
          }
          var end = start + len;
          return data.data.subarray( start, end );


        case 'r':
        case 'g':
        case 'b':
          /* image stored in packed argb */
          var res      = new Uint8Array( len );
          var imagelen = decodedWidth * decodedHeight * 4;
          var rowlen   = decodedWidth * 4;
          var collen   = 4;
          if( x < 1.0 ) x = Math.round( x * decodedWidth );
          if( y < 1.0 ) y = Math.round( y * decodedHeight );

          var ptr = (rowlen * y) + (collen * (x - lenOffset));
          switch ( component ) {
            /* image is in packet rgba format, offset to component */
            case 'r':
              ptr += 0;
              break;
            case 'g':
              ptr += 1;
              break;
            case 'b':
              ptr += 2;
              break;
          }
          var lastptr = ptr + (len * collen);
          var dex     = 0;
          while ( ptr < lastptr ) {
            res[dex] = data.data[ptr];
            dex += 1;
            ptr += collen;
          }
          return res;
      }
    },

    onPictureDecoded: function( buffer, width, height, infos ) {
    },

    // for both functions options is:
    //
    //  width
    //  height
    //  enableScreenshot
    //
    // returns a object that has a property canvas which is a html5 canvas
    createCanvasWebGL: function( options ) {
      var canvasObj            = this._createBasicCanvasObj( options );
      canvasObj.contextOptions = options.contextOptions;
      return canvasObj;
    },

    createCanvasRGB: function( options ) {
      var canvasObj = this._createBasicCanvasObj( options );
      return canvasObj;
    },

    // part that is the same for webGL and RGB
    _createBasicCanvasObj: function( options ) {
      options = options || {};

      var obj   = {};
      var width = options.width;
      if( !width ) {
        width = this._config.size.width;
      }
      var height = options.height;
      if( !height ) {
        height = this._config.size.height;
      }
      obj.canvas                       = document.createElement( 'canvas' );
      obj.canvas.classList.add('videorender')
      obj.canvas.width                 = width;
      obj.canvas.height                = height;
      obj.canvas.style.backgroundColor = this._config.backgroundColor || '#0D0E1B';
      return obj;
    },

    /**
     * use WebGL to render a yuv 4:2:2 frame
     * @param    {canvasObj, data, width, height, infos} -- options
     */
    renderFrameWebGL: function( options ) {
      var canvasObj     = options.canvasObj;
      var decodedWidth  = options.width || options.infos.decodedWidth;
      var decodedHeight = options.height || options.infos.decodedHeight;
      var newWidth      = decodedWidth;
      var newHeight     = decodedHeight;

      if( options.infos.targetScalable ) {
        /* when scaling decoded image to target area, adjust dimensions
         * to preserve decoded aspect ratio
         */
        newWidth               = options.infos.targetWidth;
        newHeight              = options.infos.targetHeight;
        var targetAspectRatio  = newWidth / newHeight;
        var decodedAspectRatio = decodedWidth / decodedHeight;
        if( targetAspectRatio > decodedAspectRatio )
          newWidth = Math.round( newHeight * decodedAspectRatio );
        else
          newHeight = Math.round( newWidth / decodedAspectRatio );
      }
      if( !canvasObj.webGLCanvas || canvasObj.canvas.width !== newWidth || canvasObj.canvas.height !== newHeight ) {
        /* no canvas yet, or target canvas size changeed */
        canvasObj.webGLCanvas      = null;
        canvasObj.canvas.width     = newWidth;
        canvasObj.canvas.height    = newHeight;
        canvasObj.webGLCanvas      = new WebGLCanvas( {
          canvas:         canvasObj.canvas,
          contextOptions: canvasObj.contextOptions,
          width:          newWidth,
          height:         newHeight,
          infos:          options.infos
        } );
        options.infos.targetWidth  = newWidth;
        options.infos.targetHeight = newHeight;
        if( this.onFrameSizeChange && typeof this.onFrameSizeChange === 'function' ) {
          this.onFrameSizeChange( options.infos );
        }
      }
      var ylen  = decodedWidth * decodedHeight;
      var uvlen = (decodedWidth / 2) * (decodedHeight / 2);

      canvasObj.webGLCanvas.drawNextOutputPicture( {
        yData:       options.data.subarray( 0, ylen ),
        yRowCnt:     decodedHeight,
        yDataPerRow: decodedWidth,
        uData:       options.data.subarray( ylen, ylen + uvlen ),
        uRowCnt:     decodedHeight / 2,
        uDataPerRow: decodedWidth / 2,
        vData:       options.data.subarray( ylen + uvlen, ylen + uvlen + uvlen ),
        vRowCnt:     decodedHeight / 2,
        vDataPerRow: decodedWidth / 2,
        infos:       options.infos
      } );
    },
    /**
     * draw RGB frame using ordinary canvas functions
     * @param    {canvasObj, data, width, height, infos} -- options
     */
    renderFrameRGB:   function( options ) {
      var canvasObj      = options.canvasObj;
      var decodedWidth   = options.width || options.infos.decodedWidth;
      var decodedHeight  = options.height || options.infos.decodedHeight;
      var newWidth       = decodedWidth;
      var newHeight      = decodedHeight;
      var sourceWidth    = options.infos.sourceWidth;
      var sourceHeight   = options.infos.sourceHeight;
      var canvasWidth    = canvasObj.canvas.width;
      var canvasHeight   = canvasObj.canvas.height;
      var targetScalable = options.infos.targetScalable;
      if( targetScalable ) {
        /* when scaling decoded image to target area, adjust dimensions
         * to preserve decoded aspect ratio
         */
        newWidth               = options.infos.targetWidth;
        newHeight              = options.infos.targetHeight;
        var targetAspectRatio  = newWidth / newHeight;
        var decodedAspectRatio = decodedWidth / decodedHeight;
        if( targetAspectRatio > decodedAspectRatio )
          newWidth = Math.round( newHeight * decodedAspectRatio );
        else
          newHeight = Math.round( newWidth / decodedAspectRatio );
      }
      else if( sourceWidth !== decodedWidth || sourceHeight !== decodedHeight ) {
        /* these are unequal when the incoming video is smaller than an integral
         *  number of 16x16 macroblocks and needs trimming before rendering */
        newWidth  = sourceWidth;
        newHeight = decodedHeight;
      }
      if( canvasWidth !== newWidth || canvasHeight !== newHeight ) {
        /* target canvas size changeed */
        options.infos.targetWidth = canvasWidth = canvasObj.canvas.width = newWidth;
        options.infos.targetHeight = canvasHeight = canvasObj.canvas.height = newHeight;
        if( this.onFrameSizeChange && typeof this.onFrameSizeChange === 'function' ) {
          this.onFrameSizeChange( options.infos );
        }
        /* need new canvas, image, and context when changing format */
        canvasObj.ctx         = null;
        canvasObj.imgData     = null;
        this.decodedCanvasObj = null;
      }

      if( !canvasObj.ctx ) {
        options.canvasObj = canvasObj.ctx = canvasObj.canvas.getContext( '2d' );
        canvasObj.globalAlpha                  = 1.0;
        canvasObj.ctx.globalCompositeOperation = 'copy';
      }

      /* three rendering cases: identity, clip only, scale and clip */
      var renderIdentity =
            decodedWidth === canvasWidth && decodedWidth === sourceWidth &&
            decodedHeight === canvasHeight && decodedHeight === sourceHeight;
      var renderClip     = (!targetScalable &&
        (decodedWidth !== sourceWidth) || decodedHeight !== sourceHeight) &&
        (decodedWidth === canvasWidth) && decodedHeight === canvasHeight;
      if( renderIdentity ) {
        /* fastest */
        if( !canvasObj.imgData ) canvasObj.imgData = canvasObj.ctx.createImageData( width, height );
        canvasObj.imgData.data.set( options.data );
        canvasObj.ctx.putImageData( imgData, 0, 0 );
      }
      else {
        /* either clip-only or scale and clip */
        var decodedCanvasObj = this.decodedCanvasObj;
        if( !decodedCanvasObj ) {
          decodedCanvasObj = this.decodedCanvasObj = {};
          decodedCanvasObj.canvas = document.createElement( 'canvas' );
          decodedCanvasObj.canvas.classList.add('videorender')

        }
        if( decodedCanvasObj.canvas.width !== decodedWidth || decodedCanvasObj.canvas.height !== decodedHeight ) {
          decodedCanvasObj.canvas.width  = decodedWidth;
          decodedCanvasObj.canvas.height = decodedHeight;
        }
        var decodedCtx     = decodedCanvasObj.ctx;
        var decodedImgData = decodedCanvasObj.imgData;
        if( !decodedCtx ) {
          decodedCanvasObj.ctx = decodedCtx = decodedCanvasObj.canvas.getContext( '2d' );
          decodedCanvasObj.ctx.globalAlpha              = 1.0;
          decodedCanvasObj.ctx.globalCompositeOperation = 'copy';
          decodedCanvasObj.imgData                      = decodedImgData = decodedCtx.createImageData( decodedWidth, decodedHeight );
        }
        var targetCtx = canvasObj.ctx;
        decodedImgData.data.set( options.data );
        decodedCtx.putImageData( decodedImgData, 0, 0 );

        if( renderClip ) {
          /* just trim black bars from right and bottom */
          targetCtx.putImageData( decodedCtx.getImageData( 0, 0, sourceWidth, sourceHeight ), 0, 0 );
        }
        else {
          /* scale, don't clip */
          var sw = sourceWidth;
          if( sw !== decodedWidth ) sw -= 1;
          targetCtx.drawImage( decodedCanvasObj.canvas,
            0, 0, sw, sourceHeight,
            0, 0, canvasObj.canvas.width, canvasObj.canvas.height );
        }
      }
    }
  };
  /* polyfill for IE 11 */
  if( !Math.trunc ) {
    Math.trunc = function( v ) {
      v = +v;
      if( !isFinite( v ) ) return v;
      return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
    };
  }

  return Player;

} ));

