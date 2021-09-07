var canvas;
var gl;

var cubeVerticesBuffer;
var cubeVerticesColorBuffer;
var cubeVerticesTextureCoordBuffer;
//var cubeVerticesIndexBuffer;
var viewportQuadBuffer;
var viewportQuadTexBuffer

var particleFBO;
var particleFBOTexture;
var MotionMap;
var MotionMapTexture;
var cubeRotation = 0.0;
var lastUpdateTime;
var deltaTime;
var ptCount_sqre = 256.0; //重要關鍵，FBO的有特定尺寸，256/512/1024 !!

var cubeImage;
var cubeTexture;

var shaderProgram;
var physicsProgram;
var perspectiveMatrix;
var mvMatrix;

//
// start
//
// Called when the canvas is created to get the ball rolling.
//
function start() {
  canvas = document.getElementById("glcanvas");

  initWebGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working

  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Here's where we call the routine that builds all the objects
    // we'll be drawing.
    initBuffers();
    initFBO();
    initMotionMap();

    // Next, load and set up the textures we'll be using.
    initTextures();

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.
    initPhysicsShaders();
    initRenderShaders();

    //滑鼠機制    
    canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;

    // Set up to draw the scene periodically.
    setInterval(drawScene, 15);
  }
}

////////////////////////////////////////////////////////////////////////////////
// initWebGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initWebGL() {
  gl = null;

  try {
    gl = canvas.getContext("experimental-webgl");
  }
  catch(e) {
  }

  // If we don't have a GL context, give up now

  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just have
// one object -- a simple two-dimensional cube.
//
function initBuffers() {
  
  // Now create an array of vertices for the gridParticle.
  var particlePos=[];
  var particleCol=[];
  var particleTex=[];
  
  // ii, jj 若由0.0開始，有瑕疵
  for(var jj=0.01; jj<ptCount_sqre; jj++)
  {
    for(var ii=0.01; ii<ptCount_sqre; ii++)
    {
      particlePos.push(ii/ptCount_sqre, jj/ptCount_sqre, 0.0);
      particleCol.push(ii/ptCount_sqre, jj/ptCount_sqre, 1.0, 1.0);
      particleTex.push(ii/ptCount_sqre, jj/ptCount_sqre);
    }
  }

  // Create a buffer for the cube's vertices.
  cubeVerticesBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particlePos), gl.STATIC_DRAW);
  
  // Now set up the colors for the vertices
  cubeVerticesColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particleCol), gl.STATIC_DRAW);
  
  // Map the texture onto the cube's faces.
  cubeVerticesTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particleTex), gl.STATIC_DRAW);

  // Create geometry for a fullscreen clipspace quad  
  var viewportQuadVertices = new Float32Array([
            -1.0, -1.0, 0.0, // 2----3
             1.0, -1.0, 0.0, // | \  |
            -1.0,  1.0, 0.0, // |  \ |
             1.0,  1.0, 0.0  // 0----1
  ]);
  // Buffer in the geometry, used to fill FBOs at the full size of the viewport
  viewportQuadBuffer = gl.createBuffer();
  gl.bindBuffer( gl.ARRAY_BUFFER, viewportQuadBuffer );
  gl.bufferData( gl.ARRAY_BUFFER, viewportQuadVertices, gl.STATIC_DRAW );
  
  var viewportQuadVerticesTex = new Float32Array([
             0.0, 0.0, // 2----3
             1.0, 0.0, // | \  |
             0.0, 1.0, // |  \ |
             1.0, 1.0, // 0----1
  ]);
  viewportQuadTexBuffer = gl.createBuffer();
  gl.bindBuffer( gl.ARRAY_BUFFER, viewportQuadTexBuffer );
  gl.bufferData( gl.ARRAY_BUFFER, viewportQuadVerticesTex, gl.STATIC_DRAW );

  /*
  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.
  cubeVerticesIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.
  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]
  // Now send the element array to GL
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
  */
  
}

//
// initFrameBuffers
//
//
function initFBO() {
  
  //create a texture for framebuffer
  particleFBOTexture = gl.createTexture();
  particleFBOTexture.unit = 0;  //???
  gl.activeTexture(gl.TEXTURE0 + particleFBOTexture.unit);//是否在初始階段，需要active? 後面需要再啓動
  gl.bindTexture(gl.TEXTURE_2D, particleFBOTexture);
  
  //option1_建立texture後沒有置入image或array，需指定尺寸width*height
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ptCount_sqre, ptCount_sqre, 0, 
                  gl.RGBA, gl.UNSIGNED_BYTE, null);       //gl.UNSIGNED_BYTE, gl.FLOAT
  //option2_也可隨意給張貼圖，代替指定FBO影像尺寸 !! 
  //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ptCount_sqre, ptCount_sqre, 0, 
  //                gl.RGBA, gl.UNSIGNED_BYTE, cubeImage);    //gl.UNSIGNED_BYTE, gl.FLOAT
  
  //需指定圖檔重覆及取樣模式
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);//gl.CLAMP_TO_EDGE, gl.REPEAT (default)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);//gl.CLAMP_TO_EDGE, gl.REPEAT (default)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);//gl.LINEAR, gl.NEAREST, gl.LINEAR_MIPMAP_NEAREST
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); //不能使用gl.LINEAR_MIPMAP_NEAREST

  //create a framebuffer
  particleFBO= gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, particleFBO);
  
  //attache the texture to it
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 
                  particleFBOTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function initMotionMap() {
  
  //create a texture for framebuffer
  MotionMapTexture = gl.createTexture();
  MotionMapTexture.unit = 2;  //???
  gl.activeTexture(gl.TEXTURE0 + MotionMapTexture.unit);//是否在初始階段，需要active? 後面需要再啓動
  gl.bindTexture(gl.TEXTURE_2D, MotionMapTexture);
  
  //option1_建立texture後沒有置入image或array，需指定尺寸width*height
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ptCount_sqre, ptCount_sqre, 0, 
                  gl.RGBA, gl.UNSIGNED_BYTE, null);       //gl.UNSIGNED_BYTE, gl.FLOAT
  //option2_也可隨意給張貼圖，代替指定FBO影像尺寸 !! 
  //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ptCount_sqre, ptCount_sqre, 0, 
  //                gl.RGBA, gl.UNSIGNED_BYTE, cubeImage);    //gl.UNSIGNED_BYTE, gl.FLOAT
  
  //需指定圖檔重覆及取樣模式
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);//gl.CLAMP_TO_EDGE, gl.REPEAT (default)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);//gl.CLAMP_TO_EDGE, gl.REPEAT (default)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);//gl.LINEAR, gl.NEAREST, gl.LINEAR_MIPMAP_NEAREST
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); //不能使用gl.LINEAR_MIPMAP_NEAREST

  //create a framebuffer
  MotionMap= gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, MotionMap);
  
  //attache the texture to it
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 
                  MotionMapTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
  cubeTexture = gl.createTexture();
  cubeTexture.unit = 1;
  gl.activeTexture(gl.TEXTURE0+cubeTexture.unit);//是否在初始階段，需要active?
  cubeImage = new Image();
  cubeImage.onload = function() { handleTextureLoaded(cubeImage, cubeTexture); }
  cubeImage.src = "MotionMap00.png";
}

function handleTextureLoaded(image, texture) {
  console.log("handleTextureLoaded, image = " + image);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
        gl.UNSIGNED_BYTE, image);
  //gl.CLAMP_TO_EDGE, gl.REPEAT (default)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  //gl.LINEAR, gl.NEAREST, gl.LINEAR_MIPMAP_NEAREST
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);  //important ?? 注意貼圖是否一直存在，先關掉需要時再開
}

////////////////////////////////////////////////////////////////////////////////
//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initPhysicsShaders() {
  // Create the shader program
  physicsProgram = gl.createProgram();
  gl.attachShader(physicsProgram, getShader(gl, "physics-vs"));
  gl.attachShader(physicsProgram, getShader(gl, "physics-fs"));
  gl.linkProgram(physicsProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(physicsProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the physics-shader program.");
  }

  physicsProgram.aVertexPositionLoc = gl.getAttribLocation(physicsProgram, "aVertexPosition");//var?
  gl.enableVertexAttribArray(physicsProgram.aVertexPositionLoc);
  physicsProgram.aTextureCoordLoc = gl.getAttribLocation(physicsProgram, "aTextureCoord");//var?
  gl.enableVertexAttribArray(physicsProgram.aTextureCoordLoc);
  
  gl.useProgram(physicsProgram);
  gl.uniform1i(gl.getUniformLocation(physicsProgram, "uParticleData"), 0);//考慮移至init或drawscene
  gl.uniform1i(gl.getUniformLocation(physicsProgram, "uPerlinData"), 1);//考慮移至init或drawscene
  gl.uniform1i(gl.getUniformLocation(physicsProgram, "uMotionMap"), 2);//考慮移至init或drawscene
}

function initRenderShaders() {

  // Create the shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, getShader(gl, "shader-vs"));
  gl.attachShader(shaderProgram, getShader(gl, "shader-fs"));
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program.");
  }

  shaderProgram.aVertexPositionLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.aVertexPositionLoc);
  shaderProgram.aTextureCoordLoc = gl.getAttribLocation(shaderProgram, "aTextureCoord"); 
  gl.enableVertexAttribArray(shaderProgram.aTextureCoordLoc);
  shaderProgram.aVertexColorLoc = gl.getAttribLocation(shaderProgram, "aVertexColor");
  gl.enableVertexAttribArray(shaderProgram.aVertexColorLoc);
  
  gl.useProgram(shaderProgram);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, "uParticleData"), 0);//考慮移至init或drawscene    
  //gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 1);//考慮移至init或drawscene
}

////////////////////////////////////////////////////////////////////////////////
//
// drawScene
//
// Draw the scene.
//
function drawScene() {
  // Clear the canvas before we start drawing on it.

  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // not sure ???

  // Establish the perspective with which we want to view the
  // scene. Our field of view is 45 degrees, with a width/height
  // ratio of 640:480, and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  perspectiveMatrix = makePerspective(45, canvas.width/canvas.height, 0.1, 100.0);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.

  loadIdentity();

  // Now move the drawing position a bit to where we want to start
  // drawing the cube.

  mvTranslate([0.0, 0.0, -2.0]);

  // Save the current matrix, then rotate before we draw.

  mvPushMatrix();
  mvRotate(cubeRotation, [0, 1, 0]);

  ///////////////// I Physics step /////////////////////////////////////////////
  
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, ptCount_sqre, ptCount_sqre);
    gl.useProgram(physicsProgram);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer); //viewportQuadTexBuffer
    gl.vertexAttribPointer(physicsProgram.aTextureCoordLoc, 2, gl.FLOAT, false, 0, 0);    //important
    
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer); //viewportQuadBuffer 
    gl.vertexAttribPointer(physicsProgram.aVertexPositionLoc, 3, gl.FLOAT, false, 0, 0);

    gl.uniform1f( gl.getUniformLocation(physicsProgram, "uTime"), (0.0001*lastUpdateTime)%1.0 );
    gl.uniform1f( gl.getUniformLocation(physicsProgram, "udTime"), deltaTime);
    
    //已經成功寫入FBO，需注意FBO尺寸
    //順序重要---------------------
    gl.activeTexture(gl.TEXTURE1);//???會干擾gl.activeTexture(gl.TEXTURE0)，Init之前已成功啓動
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);//重要，需啓動才能讀圖檔資料，因為InitTexture un-bind 
    
    gl.activeTexture(gl.TEXTURE2);//???會干擾gl.activeTexture(gl.TEXTURE0)，Init之前已成功啓動
    gl.bindTexture(gl.TEXTURE_2D, MotionMapTexture);//重要，需啓動才能讀圖檔資料，因為InitTexture un-bind 

    gl.activeTexture(gl.TEXTURE0);//重要，若physicsProgram中有讀取則需啓動
    gl.bindTexture(gl.TEXTURE_2D, particleFBOTexture);//奇怪，導致FBO無法使用，避免重覆InitFBO
    //----------------------------
    
    // Tell WebGL to use the particle FBO, not the front buffer for (offscreen) rendering
    gl.bindFramebuffer(gl.FRAMEBUFFER, particleFBO);  // draw to framebuffer
    gl.drawArrays( gl.POINTS, 0, (ptCount_sqre*ptCount_sqre));//是否有作用？
    //gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4);//是否有作用？
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays( gl.POINTS, 0, (ptCount_sqre*ptCount_sqre));//是否有作用？
    //gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4);
    

    
  ///////////////// II Render step /////////////////////////////////////////////

  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(shaderProgram);
  
    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.aTextureCoordLoc, 2, gl.FLOAT, false, 0, 0);          //important
    
    // Draw the cube by binding the array buffer to the cube's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer); //viewportQuadBuffer
    gl.vertexAttribPointer(shaderProgram.aVertexPositionLoc, 3, gl.FLOAT, false, 0, 0);
    
    // Set the colors attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesColorBuffer);
    gl.vertexAttribPointer(shaderProgram.aVertexColorLoc, 4, gl.FLOAT, false, 0, 0);
    
    setMatrixUniforms();
    setTimeUniforms();
    

    // Draw the cube.
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
    //gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.drawArrays( gl.POINTS, 0, (ptCount_sqre*ptCount_sqre) );
    //gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4);
    gl.disable( gl.BLEND );

  // Restore the original matrix
  mvPopMatrix();

  // Update the rotation for the next draw, if it's time to do so.

  var currentTime = (new Date).getTime();
  if (lastUpdateTime) {
    deltaTime = currentTime - lastUpdateTime;
    //cubeRotation += (30 * deltaTime) / 1000.0;
    //cubeRotation = 0.0;
  }

  lastUpdateTime = currentTime;
}


////////////////////////////////////////////////////////////////////////////////
//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader(gl, id) {
  var shaderScript = document.getElementById(id);

  // Didn't find an element with the specified ID; abort.

  if (!shaderScript) {
    return null;
  }

  // Walk through the source element's children, building the
  // shader source string.

  var theSource = "";
  var currentChild = shaderScript.firstChild;

  while(currentChild) {
    if (currentChild.nodeType == 3) {
      theSource += currentChild.textContent;
    }

    currentChild = currentChild.nextSibling;
  }

  // Now figure out what type of shader script we have,
  // based on its MIME type.

  var shader;

  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;  // Unknown shader type
  }

  // Send the source to the shader object

  gl.shaderSource(shader, theSource);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

////////////////////////////////////////////////////////////////////////////////
//
// Matrix utility functions
//

function loadIdentity() {
  mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
  mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
  multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms() {
  var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

  var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}

function setTimeUniforms() {
  var timeUniform = gl.getUniformLocation(shaderProgram, "uTime");
  gl.uniform1f( timeUniform, (0.001*lastUpdateTime)%10.0 );
  var dtimeUniform = gl.getUniformLocation(shaderProgram, "udTime");
  gl.uniform1f( dtimeUniform, deltaTime);
}

var mvMatrixStack = [];

function mvPushMatrix(m) {
  if (m) {
    mvMatrixStack.push(m.dup());
    mvMatrix = m.dup();
  } else {
    mvMatrixStack.push(mvMatrix.dup());
  }
}

function mvPopMatrix() {
  if (!mvMatrixStack.length) {
    throw("Can't pop from an empty matrix stack.");
  }

  mvMatrix = mvMatrixStack.pop();
  return mvMatrix;
}

function mvRotate(angle, v) {
  var inRadians = angle * Math.PI / 180.0;
  var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
  multMatrix(m);
}

////////////////////////////////////////////////////////////////////////////////
//
//滑鼠機制
//
function degToRad(degrees) {
        return degrees * Math.PI / 180.0;
}
    var mouseDown = false;
    var lastMouseX = null;
    var lastMouseY = null;

    function handleMouseDown(event) {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    function handleMouseUp(event) {
        mouseDown = false;
    }

    function handleMouseMove(event) {
        //滑鼠按下時才作用
        if (!mouseDown) {
            return;
        }        
        var newX = event.clientX;
        var newY = event.clientY;

        var deltaX = newX - lastMouseX
        //var newRotationMatrix = mat4.create();
        //mat4.identity(newRotationMatrix);
        //mat4.rotate(newRotationMatrix, degToRad(deltaX / 10), [0, 1, 0]);
        cubeRotation +=  deltaX*0.5;
        
        var deltaY = newY - lastMouseY;
        //mat4.rotate(newRotationMatrix, degToRad(deltaY / 10), [1, 0, 0]);
        //mat4.multiply(newRotationMatrix, moonRotationMatrix, moonRotationMatrix);

        lastMouseX = newX
        lastMouseY = newY;
    }