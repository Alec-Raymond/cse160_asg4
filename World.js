// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    v_Normal = a_Normal;
    v_VertPos = u_ModelMatrix * a_Position;
    }`;

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;

  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform sampler2D u_Sampler4;
  uniform int u_whichTexture;

  // Main light
  uniform vec3 u_lightPos;
  uniform vec3 u_cameraPos;
  uniform vec3 u_lightColor;
  uniform bool u_lightOn;

  // Spotlight
  // Position of the spotlight (above and slightly in front of the scene)
  vec3 u_spotLightPos = vec3(-0.5, 5.0, -0.5);

  // Direction the spotlight is pointing (pointing downward)
  vec3 u_spotLightDir = vec3(0.1, -1.0, 0.0);

  // Color of the spotlight (white light)
  vec3 u_spotLightColor = vec3(1.0, 0.0, 1.0);

  // Cosine of the cutoff angle (e.g., 30 degrees spotlight cone)
  float u_spotCosineCutoff = cos(radians(10.0));  // ~0.866

  // Spotlight intensity falloff (higher = sharper spotlight)
  float u_spotExponent = 5.0;

  uniform bool u_spotlightOn;

  void main() {
    // Texture selection
    if (u_whichTexture == -3) {
        gl_FragColor = vec4((v_Normal + 1.0) / 2.0, 1.0);
    } else if (u_whichTexture == -2) {
        gl_FragColor = u_FragColor;
    } else if (u_whichTexture == -1) {
        gl_FragColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {
        gl_FragColor = texture2D(u_Sampler0, v_UV);
    } else if (u_whichTexture == 1) {
        gl_FragColor = texture2D(u_Sampler1, v_UV);
    } else if (u_whichTexture == 2) {
        gl_FragColor = texture2D(u_Sampler2, v_UV);
    } else if (u_whichTexture == 3) {
        gl_FragColor = texture2D(u_Sampler3, v_UV);
    } else if (u_whichTexture == 4) {
        gl_FragColor = texture2D(u_Sampler4, v_UV);
    } else {
        gl_FragColor = vec4(1.0, 0.2, 0.2, 1.0);
    }

    vec3 totalLight = vec3(0.0);

    // ==== Main Light Calculation ====
    if (u_lightOn) {
        vec3 L = normalize(u_lightPos - vec3(v_VertPos));
        vec3 N = normalize(v_Normal);
        float nDotL = max(dot(N, L), 0.0);

        vec3 R = reflect(-L, N);
        vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
        vec3 specular = pow(max(dot(E, R), 0.0), 64.0) * 0.8 * u_lightColor;

        vec3 diffuse = u_lightColor * vec3(gl_FragColor) * nDotL * 0.7;
        vec3 ambient = u_lightColor * vec3(gl_FragColor) * 0.2;

        totalLight += diffuse + ambient + specular;
    }

    // ==== Spotlight Calculation ====
    if (u_spotlightOn) {
        vec3 L_spot = normalize(u_spotLightPos - vec3(v_VertPos));
        vec3 N = normalize(v_Normal);
        float nDotL_spot = max(dot(N, L_spot), 0.0);

        vec3 R_spot = reflect(-L_spot, N);
        vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
        vec3 specular_spot = pow(max(dot(E, R_spot), 0.0), 64.0) * 0.8 * u_spotLightColor;

        float spotFactor = 1.0;
        vec3 D = -normalize(u_spotLightDir); // Spotlight direction (normalized)
        float spotCosine = dot(D, L_spot); // Angle between light direction and spotlight direction

        if (u_spotCosineCutoff > 0.0) {
            if (spotCosine >= u_spotCosineCutoff) {
                spotFactor = pow(spotCosine, u_spotExponent);
            } else {
                spotFactor = 0.0; // Outside the spotlight cone
            }
        }

        vec3 diffuse_spot = u_spotLightColor * vec3(gl_FragColor) * nDotL_spot * 0.7;
        vec3 ambient_spot = u_spotLightColor * vec3(gl_FragColor) * 0.2;
        vec3 finalSpotLight = (specular_spot + diffuse_spot + ambient_spot) * spotFactor;

        totalLight += finalSpotLight;
    }
    if (u_spotlightOn || u_lightOn) {
      gl_FragColor = vec4(totalLight, 1.0);
    }
}`;


let canvas;
let gl;
let a_Position;
let a_UV;
let a_Normal;
let u_FragColor;
let u_ModelMatrix;
let u_ProjectionMatrix;
let u_ViewMatrix;
let u_GlobalRotateMatrix;
let u_Sampler0;
let u_Sampler1;
let u_Sampler2;
let u_Sampler3;
let u_Sampler4;
let u_whichTexture;
let u_lightPos;
let u_cameraPos;
let u_lightOn;
let u_spotlightOn;
let u_lightColor;

function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');


  // Get the rendering context for WebGL
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
  gl.enable(gl.DEPTH_TEST);

}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }

  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_lightOn = gl.getUniformLocation(gl.program, 'u_lightOn');
  if (!u_lightOn) {
    console.log('Failed to get the storage location of u_lightOn');
    return;
  }

  u_spotlightOn = gl.getUniformLocation(gl.program, 'u_spotlightOn');
  if (!u_spotlightOn) {
    console.log('Failed to get the storage location of u_spotlightOn');
    return;
  }
  
  u_lightColor = gl.getUniformLocation(gl.program, 'u_lightColor');
  if (!u_lightOn) {
    console.log('Failed to get the storage location of u_lightColor');
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler0');
    return false;
  }

  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler1');
    return false;
  }

  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  if (!u_Sampler2) {
    console.log('Failed to get the storage location of u_Sampler2');
    return false;
  }

  u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
  if (!u_Sampler3) {
    console.log('Failed to get the storage location of u_Sampler3');
    return false;
  }

  u_Sampler4 = gl.getUniformLocation(gl.program, 'u_Sampler4');
  if (!u_Sampler4) {
    console.log('Failed to get the storage location of u_Sampler4');
    return false;
  }

  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return false;
  }

  u_lightPos = gl.getUniformLocation(gl.program, 'u_lightPos');
  if (!u_lightPos) {
    console.log('Failed to get the storage location of u_lightPos');
    return false;
  }

  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  if (!u_lightPos) {
    console.log('Failed to get the storage location of u_cameraPos');
    return false;
  }

  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }

  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }

  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;
const OVAL = 3;

let g_selectedColor = [1.0, 1.0, 1.0, 1.0];
let g_selectedSize = 20;
let g_selectedType = POINT;
let g_segmentCount = 20;
let g_ovalShape = 0.3;
let g_globalAngleX = 0;
let g_globalAngleY = 0;
let g_crabX = 0.0;
let g_crabArm = 0.0;
let g_crabPinch = 0.0;
let g_moveAnimation = false;
let g_armAnimation = false;
let g_pinchAnimation = false;
let g_isDragging = false;
let g_lastX, g_lastY;
let g_rotationX = 0, g_rotationY = 0;
let trackedChange = 0;
let g_poked = false;
let g_pokedTime;
let g_eyeScale = 1.0;
var g_vertexBuffer = null;
var g_uvBuffer = null;
var g_normalBuffer = null;
var g_jump = 0;
var g_normalOn = false;
var g_lightOn = true;
var g_spotlightOn = true;
var g_lightPos = [0,2,0]
var g_lightColor = [1.0,1.0,1.0]

let keys = {
  'W': false,
  'A': false,
  'S': false,
  'D': false,
  'E': false,
  'Q': false,
  'V': false,
  'C': false,
  'Space': false
};

function addActionsForHtmlUI() {
  document.getElementById('normalOn').onclick = function () { g_normalOn = true; };
  document.getElementById('normalOff').onclick = function () { g_normalOn = false; };
  document.getElementById('lightOn').onclick = function () { g_lightOn = true; };
  document.getElementById('lightOff').onclick = function () { g_lightOn = false; };
  document.getElementById('spotlightOn').onclick = function () { g_spotlightOn = true; };
  document.getElementById('spotlightOff').onclick = function () { g_spotlightOn = false; };
  document.getElementById('lightSlideX').addEventListener('mousemove', function (ev) { g_lightPos[0] = this.value / 100; renderAllShapes(); console.log(g_lightPos)} );
  document.getElementById('lightSlideY').addEventListener('mousemove', function (ev) { g_lightPos[1] = this.value / 100 + 2; renderAllShapes(); } );
  document.getElementById('lightSlideZ').addEventListener('mousemove', function (ev) { g_lightPos[2] = this.value / 100; renderAllShapes(); } );
  document.getElementById('lightSlideRed').addEventListener('mousemove', function (ev) { g_lightColor[0] = this.value / 255; renderAllShapes(); } );
  document.getElementById('lightSlideGreen').addEventListener('mousemove', function (ev) { g_lightColor[1] = this.value / 255; renderAllShapes(); } );
  document.getElementById('lightSlideBlue').addEventListener('mousemove', function (ev) { g_lightColor[2] = this.value / 255; renderAllShapes(); } );
  canvas.addEventListener("mousedown", (event) => {
    if (!g_isDragging) {
      g_isDragging = true;
      g_lastX = event.clientX;
      g_lastY = event.clientY;
    } else {
      g_isDragging = false;
    }
  });

  canvas.addEventListener("mouseup", () => {

  });

  canvas.addEventListener("mousemove", (event) => {
    if (!g_isDragging) return;

    let deltaX = event.clientX - g_lastX;
    //console.log("X:", deltaX)
    let deltaY = event.clientY - g_lastY;
    //console.log("Y:", deltaY)
    //console.log(deltaY)
    g_lastX = event.clientX;
    g_lastY = event.clientY;
    trackedChange += deltaX;
    let d = new Vector3(g_at.elements);
    d.sub(g_eye);

    let r = Math.sqrt(d.elements[0] ** 2 + d.elements[2] ** 2);
    theta = Math.atan2(d.elements[2], d.elements[0]);
    theta += deltaX * 0.25 * Math.PI / 36;
    g_at.elements[0] = r * Math.cos(theta);
    g_at.elements[2] = r * Math.sin(theta);
    console.log(-0.5 * (Math.abs(deltaY)) * (deltaY ** 2));
    g_at.elements[1] += -0.7 * deltaY;
    //g_globalAngleX += deltaX * 0.7;
    //g_globalAngleY += deltaY * 0.7;
    //renderAllShapes();
  });

  canvas.addEventListener("click", (event) => {
    if (event.shiftKey) {
      g_poked = true;
      g_pokedTime = performance.now();
    }
  });
}


function initTextures() {
  var image0 = new Image();  // Create the image object
  if (!image0) {
    console.log('Failed to create the image0 object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image0.onload = function () { sendTextureToTEXTURE0(image0); };
  // Tell the browser to load an image
  image0.src = 'path.jpg';

  var image1 = new Image();  // Create the image object
  if (!image1) {
    console.log('Failed to create the image1 object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image1.onload = function () { sendTextureToTEXTURE1(image1); };
  // Tell the browser to load an image
  image1.src = 'sky.jpg';

  var image2 = new Image();  // Create the image object
  if (!image2) {
    console.log('Failed to create the image2 object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image2.onload = function () { sendTextureToTEXTURE2(image2); };
  // Tell the browser to load an image
  image2.src = 'corn.jpg';

  var image3 = new Image();  // Create the image object
  if (!image3) {
    console.log('Failed to create the image3 object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image3.onload = function () { sendTextureToTEXTURE3(image3); };
  // Tell the browser to load an image
  image3.src = 'you_win.jpg';

  var image4 = new Image();  // Create the image object
  if (!image4) {
    console.log('Failed to create the image3 object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image4.onload = function () { sendTextureToTEXTURE4(image4); };
  // Tell the browser to load an image
  image4.src = 'destructable_corn.jpg';

  return true;
}

function sendTextureToTEXTURE0(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler0, 0);
}

function sendTextureToTEXTURE1(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE1);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler1, 1);
}

function sendTextureToTEXTURE2(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE2);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler2, 2);
}

function sendTextureToTEXTURE3(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE3);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler3, 3);
}

function sendTextureToTEXTURE4(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE4);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler4, 4);
}

function main() {
  setupWebGL();

  connectVariablesToGLSL();

  addActionsForHtmlUI();

  document.onkeydown = keydown;

  // Register function (event handler) to be called on a mouse press
  //canvas.onmousedown = function (ev) { click(ev); };
  //canvas.onmousemove = function (ev) { if (ev.buttons == 1) { click(ev); } };
  // Specify the color for clearing <canvas>
  initTextures(gl, 0);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  //gl.clear(gl.COLOR_BUFFER_BIT);
  //renderAllShapes();
  requestAnimationFrame(tick);
}

var g_shapesList = [];

function click(ev) {
  [x, y] = convertCoordinatesEventToGL(ev);


  let shape;
  if (g_selectedType == POINT) {
    shape = new Point();
  } else if (g_selectedType == TRIANGLE) {
    shape = new Triangle();
  } else if (g_selectedType == CIRCLE) {
    shape = new Circle();
    shape.segments = g_segmentCount;
  } else {
    shape = new Oval();
    shape.segments = g_segmentCount;
    shape.width = g_ovalShape < 0.5 ? 1.0 : 1.0 - 2 * (g_ovalShape - 0.5);
    shape.height = g_ovalShape < 0.5 ? 1.0 - 2 * (0.5 - g_ovalShape) : 1.0;
  }
  shape.position = [x, y];
  shape.color = g_selectedColor.slice();
  shape.size = g_selectedSize;
  g_shapesList.push(shape);
  console.log(shape.type);
  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

  return [x, y];
}

var g_eye = new Vector3([-0.5, 1.2, -0.5]);
var g_at = new Vector3([100, 0.2, 0]);
var g_up = new Vector3([0, 1, 0]);



var g_map = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

var g_destructable_map = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

function drawMap() {
  for (x = 0; x < 8; x++) {
    for (y = 0; y < 8; y++) {
      if (g_map[x][y] == 1) {
        var body = new Cube();
        body.textureNum = 2;
        if (x == 7 && y == 6) {
          body.textureNum = 3;
        }
        body.color = [1.0, 1.0, 1.0, 1.0];
        body.matrix.scale(1, 1.5, 1);
        body.matrix.translate(x - 4, -.45, y - 4);
        body.render();
      } else if (g_destructable_map[x][y] == 1) {
        var body = new Cube();
        body.textureNum = 4;
        body.color = [1.0, 1.0, 1.0, 1.0];
        body.matrix.scale(1, 1.5, 1);
        body.matrix.translate(x - 4, -0.45, y - 4);
        body.render();
      }
    }
  }
}


function renderAllShapes() {
  var startTime = performance.now();

  var projMat = new Matrix4();
  projMat.setPerspective(120, 1 * canvas.width / canvas.height, .1, 100);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

  var viewMat = new Matrix4();
  viewMat.setLookAt(g_eye.elements[0], g_eye.elements[1], g_eye.elements[2], g_at.elements[0], g_at.elements[1], g_at.elements[2], g_up.elements[0], g_up.elements[1], g_up.elements[2]); // (eye, at, up)
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

  var globalRotMat = new Matrix4().rotate(g_globalAngleX % 360, 0, 1, 0).rotate(g_globalAngleY % 360, 1, 0, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);
  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);

  //var len = g_shapesList.length;
  //for (var i = 0; i < len; i++) {
  //  g_shapesList[i].render();
  //}

  gl.uniform3f(u_lightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  gl.uniform3f(u_lightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
  gl.uniform3f(u_cameraPos, g_eye.elements[0], g_eye.elements[1], g_eye.elements[2]);
  gl.uniform1i(u_lightOn, g_lightOn)
  gl.uniform1i(u_spotlightOn, g_spotlightOn)
  var light = new Cube();
  light.color = [1.0,1.0,0.0,1.0];
  light.textureNum = -2;
  light.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  light.matrix.scale(-0.1,-0.1,-0.1)
  light.matrix.translate(-0.5,-0.5,-0.5);
  light.render();


  var ground = new Cube();
  ground.color = [1.0, 0.0, 0.0, 1.0];
  ground.textureNum = 0;
  ground.matrix.translate(0, -.75, 0.0);
  ground.matrix.scale(16, 0.001, 16);
  //ground.matrix.translate(-0.5, 0, -0.5);
  ground.render();

  ground.matrix.translate(-1, 0, -1);
  ground.render();

  ground.matrix.translate(1, 0, 0);
  ground.render();

  ground.matrix.translate(-1, 0, 1);
  ground.render();



  var sky = new Cube();
  sky.color = [1.0, 0.0, 0.0, 1.0];
  sky.textureNum = 1;
  sky.matrix.scale(-10, -10, -10);
  sky.matrix.translate(-0.5, -0.5, -0.5);
  sky.render();

  var sphere = new Sphere();
  sphere.textureNum = 1;
  if (g_normalOn) {
    sphere.textureNum = -3
  }
  sphere.matrix.translate(1.5, 1.5, -0.5);
  sphere.matrix.scale(0.5,0.5,0.5)
  sphere.render();

  drawMap();

  /*
  var arm1 = new Cube();
  arm1.color = [1.0, 0.0, 0.0, 1.0];
  arm1.matrix = new Matrix4(bodyMat);
  arm1.matrix.translate(0.25, .3, 0.1);
  arm1.matrix.rotate(80, 40 - g_crabArm, 10, 1);
  var armMat = new Matrix4(arm1.matrix);
  arm1.matrix.scale(0.5, 0.1, 0.1);
  arm1.render();

  var arm2 = new Cube();
  arm2.color = [1.0, 0.0, 0.0, 1.0];
  arm2.matrix = new Matrix4(bodyMat); // Start with body matrix
  arm2.matrix.translate(-0.25, 0.4 + g_crabArm / 250.0, 0); // Mirror arm1's position (opposite side)
  arm2.matrix.rotate(-80, -40, 10, 1); // Apply the same rotation as arm1
  var arm2Mat = new Matrix4(arm2.matrix);
  arm2.matrix.scale(0.5, 0.1, 0.1); // Scale arm2
  arm2.render();

  var claw1 = new Cube();
  claw1.color = [1.0, 0.0, 0.0, 1.0];
  claw1.matrix = new Matrix4(armMat);
  claw1.matrix.translate(0.4, 0, 0);
  claw1.matrix.rotate(g_crabPinch, 0, 0, 1);
  claw1.matrix.rotate(50, 0, 40, 1);
  claw1.matrix.scale(0.3, 0.1, 0.2);
  claw1.render();

  var claw2 = new Cube();
  claw2.color = [1.0, 0.0, 0.0, 1.0];
  claw2.matrix = new Matrix4(arm2Mat);
  claw2.matrix.translate(-0.05, 0, 0.1);
  claw2.matrix.rotate(130, 0, 40, 1);
  claw2.matrix.rotate(g_crabPinch, 0, 0, 1);
  claw2.matrix.scale(0.3, 0.1, 0.2);
  claw2.render();

  var pinch1 = new Cube();
  pinch1.color = [1.0, 0.0, 0.0, 1.0];
  pinch1.matrix = new Matrix4(armMat);
  pinch1.matrix.translate(0.45, -0.15, 0);
  pinch1.matrix.rotate(0.2 * -g_crabPinch, 0, 0, 1);
  pinch1.matrix.rotate(50, -50, -30, 1);
  pinch1.matrix.scale(0.2, 0.1, 0.2);
  pinch1.render();

  var pinch2 = new Cube();
  pinch2.color = [1.0, 0.0, 0.0, 1.0];
  pinch2.matrix = new Matrix4(arm2Mat);
  pinch2.matrix.rotate(-30, 30, -50, 1);
  pinch2.matrix.rotate(0.2 * -g_crabPinch, 0, 0, 1);
  pinch2.matrix.translate(-0.1, -0.1, -0.1);
  pinch2.matrix.scale(0.2, 0.1, 0.2);
  pinch2.render();

  var eye1 = new Sphere();
  eye1.color = [0.2, 0.0, 0.0, 1.0];
  eye1.matrix = new Matrix4(bodyMat);
  eye1.matrix.translate(0.15, 0.35, 0);
  eye1.matrix.scale(0.03 * g_eyeScale, 0.03 * g_eyeScale, 0.03 * g_eyeScale);
  eye1.render();

  var eye2 = new Sphere();
  eye2.color = [0.2, 0.0, 0.0, 1.0];
  eye2.matrix = new Matrix4(bodyMat);
  eye2.matrix.translate(0.35, 0.35, 0);
  eye2.matrix.scale(0.03 * g_eyeScale, 0.03 * g_eyeScale, 0.03 * g_eyeScale);
  eye2.render();

  var mouth = new Cube();
  mouth.color = [0.2, 0.0, 0.0, 1.0];
  mouth.matrix = new Matrix4(bodyMat);
  mouth.matrix.translate(0.1 - 0.1 * g_crabX, 0.05, -0.01);
  mouth.matrix.scale(0.3, 0.03, 0.03);
  mouth.render();*/

  var duration = performance.now() +1 - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000 / duration) / 10, "numdot");
}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (htmlElm) {
    htmlElm.innerHTML = text;
  }
}

var g_startTime = performance.now() / 1000.0;
var g_seconds = performance.now() / 1000.0 - g_startTime;

function tick() {
  g_seconds = performance.now() / 1000.0 - g_startTime;
  console.log("test");
  updateAnimationAngles();
  updateMovement();
  renderAllShapes();

  requestAnimationFrame(tick);
}

function updateAnimationAngles() {
  if (g_jump > 0) {
    g_jump++;
    if (g_jump < 10) {
      console.log("aloha");
      g_eye.elements[1] += 0.01;
    } else if (g_jump < 20) {
      g_eye.elements[1] += 0.005;
    } else if (g_jump < 25) {
      g_eye.elements[1] += 0.001;
    } else if (g_jump < 30) {
      g_eye.elements[1] -= 0.001;
    } else if (g_jump < 40) {
      g_eye.elements[1] -= 0.005;
    } else if (g_jump < 50) {
      g_eye.elements[1] -= 0.01;
    } else {
      g_jump = 0;
    }
  }
  g_lightPos[0] = Math.cos(g_seconds)
}

function updateMovement() {
  let d = new Vector3(g_at.elements);
  d.sub(g_eye);
  d.elements[1] = 0;
  d.normalize();

  let y = new Vector3([0, 1, 0]);
  let right = Vector3.cross(d, y);
  right.normalize();
  let left = Vector3.cross(y, d);
  left.normalize();

  let eye_prev = new Vector3(g_eye.elements);
  let at_prev = new Vector3(g_at.elements);

  if (keys['A']) {
    left.mul(0.025); // Adjust the speed as needed
    g_eye.add(left);
    g_at.add(left);
  }
  if (keys['W']) {
    d.mul(0.05); // Adjust the speed as needed
    g_eye.add(d);
    g_at.add(d);
  }
  if (keys['D']) {
    right.mul(0.025); // Adjust the speed as needed
    g_eye.add(right);
    g_at.add(right);
  }
  if (keys['S']) {
    d.mul(-0.05); // Adjust the speed as needed
    g_eye.add(d);
    g_at.add(d);
  }

  // Handle collision detection
  if (eye_prev.elements != g_eye.elements) {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        if (g_map[x][y] == 1 || g_destructable_map[x][y] == 1) {
          if (g_eye.elements[0] > (x - 4.1) && g_eye.elements[0] < x - 2.9 && g_eye.elements[2] > y - 4.1 && g_eye.elements[2] < y - 2.9) {
            console.log("collision detected: ", x, y);
            g_eye = eye_prev;
            g_at = at_prev;
          }
        }
      }
    }
  }
}

function keydown(ev) {
  let d = new Vector3(g_at.elements);
  d.sub(g_eye);
  d.elements[1] = 0;


  let r = Math.sqrt(d.elements[0] ** 2 + d.elements[2] ** 2);
  theta = Math.atan2(d.elements[2], d.elements[0]);

  d.normalize();
  if (ev.keyCode == 65) keys['A'] = true; // A
  else if (ev.keyCode == 87) keys['W'] = true; // W
  else if (ev.keyCode == 68) keys['D'] = true; // D
  else if (ev.keyCode == 83) keys['S'] = true; // S
  else if (ev.keyCode == 69) {
    theta += Math.PI / 36;
    g_at.elements[0] = r * Math.cos(theta);
    g_at.elements[2] = r * Math.sin(theta);
  } else if (ev.keyCode == 81) {
    theta -= Math.PI / 36;
    g_at.elements[0] = r * Math.cos(theta);
    g_at.elements[2] = r * Math.sin(theta);
  } else if (ev.keyCode == 86) {
    //d.mul(1.6);
    d.add(g_eye);
    for (x = 0; x < 8; x++) {
      for (y = 0; y < 8; y++) {
        if (g_destructable_map[x][y] == 1) {
          if (d.elements[0] > (x - 4) && d.elements[0] < x - 3 && d.elements[2] > y - 4 && d.elements[2] < y - 3) {
            g_destructable_map[x][y] = 0;
          }
        }
      }
    }
  } else if (ev.keyCode == 67) {
    //d.mul(1.6);
    d.add(g_eye);
    for (x = 0; x < 8; x++) {
      for (y = 0; y < 8; y++) {
        if (g_destructable_map[x][y] == 0) {
          if (d.elements[0] > (x - 4) && d.elements[0] < x - 3 && d.elements[2] > y - 4 && d.elements[2] < y - 3) {
            g_destructable_map[x][y] = 1;

          }

        }
      }
    }
  } else if (ev.keyCode == 32 && g_jump == 0) {
    g_jump = 1;
  }

}

function keyup(ev) {
  if (ev.keyCode == 65) keys['A'] = false; // A
  else if (ev.keyCode == 87) keys['W'] = false; // W
  else if (ev.keyCode == 68) keys['D'] = false; // D
  else if (ev.keyCode == 83) keys['S'] = false; // S

}

// Add event listeners for keydown and keyupa
window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);
