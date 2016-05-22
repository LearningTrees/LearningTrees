var WILL = {
    backgroundColor: Module.Color.WHITE,
    strokes: new Array(),
    server: null,
    init: function (width, height, server) {

        this.initInkEngine(width, height, server);
        this.initEvents();
    },

    initInkEngine: function (width, height, server) {
        this.canvasElement = document.getElementById("canvas");
        this.server = server;
        this.canvas = new Module.InkCanvas(this.canvasElement, width, height);
        this.strokesLayer = this.canvas.createLayer();

        this.brush = new Module.SolidColorBrush();

        this.pathBuilder = new Module.SpeedPathBuilder();
        this.pathBuilder.setNormalizationConfig(182, 3547);
        this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 2.05, 34.53, 0.72, NaN, Module.PropertyFunction.Power, 1.19, false);

        this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

        this.viewArea = this.strokesLayer.bounds;

        client.init(server);

        this.writer = new Writer(client.id , client.uid);
        client.writers[client.id] = this.writer;

        this.clearCanvas();
    },

    initEvents: function () {
        var self = this;
        $(Module.canvas).on("mousedown", function (e) { self.beginStroke(e); });
        $(Module.canvas).on("mousemove", function (e) { self.moveStroke(e); });
        $(document).on("mouseup", function (e) { self.endStroke(e); });
        $(Module.canvas).on("mouseout", function (e) { if (self.writer.inputPhase) self.writer.abort(); });
    },
    setMode : function(mode) {
        //this.Mode = mode;
        // 1 For drawing , 2 For erasing
        if (mode == 1) {
            this.writer.strokeRenderer.configure({ brush: WILL.brush, color: ((client.uid == 1) ? Module.Color.BLUE : Module.Color.GREEN), width: 1 });
        } else {
            this.writer.strokeRenderer.configure({ brush: WILL.brush, color: Module.Color.WHITE, width:  5});
        }
        //console.log('mode changed to ' + this.Mode);
    },
    beginStroke: function (e) {
        
        if (["mousedown", "mouseup"].contains(e.type) && e.button != 0) return;

        this.writer.inputPhase = Module.InputPhase.Begin;

        this.buildPath(getMousePos(this.canvasElement, e));
        this.drawPath();

        client.encoder.encodeComposeStyle(this.writer.strokeRenderer);
        client.send();
        
    },

    moveStroke: function (e) {
        if (!this.writer.inputPhase) return;

        this.writer.inputPhase = Module.InputPhase.Move;
        this.pointerPos = getMousePos(this.canvasElement, e);
        if (WILL.frameID != WILL.canvas.frameID) {
            var self = this;
            //console.log('Frame Id' + WILL.frameID);
            WILL.frameID = WILL.canvas.requestAnimationFrame(function () {
                if (self.writer.inputPhase && self.writer.inputPhase == Module.InputPhase.Move) {
                    self.buildPath(self.pointerPos);
                    self.drawPath();
                }
            }, true);
        }
        
    },

    endStroke: function (e) {
        if (!this.writer.inputPhase) return;

        this.writer.inputPhase = Module.InputPhase.End;

        
        this.buildPath(getMousePos(this.canvasElement, e));
        this.drawPath();

        client.encoder.encodeAdd([{
            brush: this.brush,
            path: this.path,
            width: this.writer.strokeRenderer.width,
            color: this.writer.strokeRenderer.color,
            ts: 0, tf: 1, randomSeed: 0,
            blendMode: this.writer.strokeRenderer.blendMode
        }]);
        client.send();
        
    },

    buildPath: function (pos) {

        if (this.writer.inputPhase == Module.InputPhase.Begin)
            this.smoothener.reset();

        var pathPart = this.pathBuilder.addPoint(this.writer.inputPhase, pos, Date.now() / 1000);
        var smoothedPathPart = this.smoothener.smooth(pathPart, this.writer.inputPhase == Module.InputPhase.End);
        var pathContext = this.pathBuilder.addPathPart(smoothedPathPart);

        this.pathPart = pathContext.getPathPart();
        this.path = pathContext.getPath();

        if (this.writer.inputPhase == Module.InputPhase.Move) {
            var preliminaryPathPart = this.pathBuilder.createPreliminaryPath();
            var preliminarySmoothedPathPart = this.smoothener.smooth(preliminaryPathPart, true);

            this.preliminaryPathPart = this.pathBuilder.finishPreliminaryPath(preliminarySmoothedPathPart);
        }
        
    },

    drawPath: function () {
        this.writer.compose(this.pathPart, this.writer.inputPhase == Module.InputPhase.End);
    },

    refresh: function (dirtyArea) {
        if (!dirtyArea) dirtyArea = this.canvas.bounds;
        dirtyArea = Module.RectTools.ceil(dirtyArea);

        this.canvas.clear(dirtyArea, this.backgroundColor);
        this.canvas.blend(this.strokesLayer, { rect: dirtyArea });
    },

    clear: function () {
        this.server.clear();
    },

    clearCanvas: function () {
        this.strokes = new Array();

        this.strokesLayer.clear(this.backgroundColor);
        this.canvas.clear(this.backgroundColor);
    }
}; 


function Writer(id, uid) {
    this.id = id;
    this.uid = uid;
    this.strokeRenderer = new Module.StrokeRenderer(WILL.canvas);
    this.strokeRenderer.configure({ brush: WILL.brush, color: ((this.uid == 1) ? Module.Color.BLUE : Module.Color.GREEN), width: 1 });
    //this.strokeRenderer.configure({ brush: WILL.brush, color: (Module.Color.BLUE) });

    //this.intersector = new Module.Intersector();
}

Writer.prototype.refresh = function () {
    if (this.id == client.id && this.inputPhase == Module.InputPhase.Move)
        this.strokeRenderer.drawPreliminary(WILL.preliminaryPathPart);

    //WILL.canvas.clear(this.strokeRenderer.updatedArea, WILL.backgroundColor);
    //WILL.canvas.blend(WILL.strokesLayer, { rect: this.strokeRenderer.updatedArea });

    this.strokeRenderer.blendUpdatedArea();
}

Writer.prototype.compose = function (path, endStroke) {
    if (path.points.length == 0)
        return;

    this.strokeRenderer.draw(path, endStroke, this.id != client.id);

    if (this.id == client.id) {
        if (this.strokeRenderer.updatedArea)
            this.refresh();

        if (endStroke)
            delete this.inputPhase;

        client.encoder.encodeComposePathPart(path, this.strokeRenderer.color, true, false, endStroke);
        client.send();
    }
}

Writer.prototype.abort = function () {
    var dirtyArea = Module.RectTools.union(this.strokeRenderer.strokeBounds, this.strokeRenderer.preliminaryDirtyArea);

    this.strokeRenderer.abort();
    delete this.inputPhase;

    WILL.refresh(dirtyArea);

    if (this.id == client.id) {
        client.encoder.encodeComposeAbort();
        client.send();
    }
}

var client = {
    name: window.name,
    writers: [],
    server: null,
    init: function (server) {
        //this.id = parent.server.getSessionID(this.name);
        //console.log("this name " + env.width + " " + env.height);
        this.uid = $('#UserId').val();
        this.id = $('#conn-id').val();
        console.log("client id = " + this.id + ' ' + this.uid);
        this.server = server;
        this.encoder = new Module.PathOperationEncoder();
        this.decoder = new Module.PathOperationDecoder(Module.PathOperationDecoder.getPathOperationDecoderCallbacksHandler(this.callbacksHandlerImplementation));
    },

    send: function (compose) {
        //console.log("client send = " + this.id + " " + Module.readBytes(this.encoder.getBytes()));
        //this.server.send('tester', 'this is a test');
        //this.server.send('tester' , 'null');
        //this.server.receiveDrawing(this.encoder.getBytes());

        //console.log('client send = ' + Module.readBytes(this.encoder.getBytes()));
        var uint8array = Module.readBytes(this.encoder.getBytes());
        //var string = new TextDecoder("utf-8").decode(uint8array);
        //var data = ab2str();
        this.server.receive(this.id, uint8array, compose);
        //this.server.receive(this.id, this.encoder.getBytes(), compose);
        this.encoder.reset();
    },

    receive: function (sender, data) {
        var writer = this.writers[sender];
        //console.log('client receive = ' + data);
        var lenght = 0;
        var array = [];
        for (var i in data) {
            array[i] = data[i];
            lenght++;
        }
        var unit8Array = new Uint8Array(array);
        //console.log('client receive lenght = ' + unit8Array);
        //var unit8Array = new Uint8Array(data);
        if (!writer) {
            writer = new Writer(sender);
            this.writers[sender] = writer;
        }

        Module.writeBytes(unit8Array, function (int64Ptr) {
            this.decoder.decode(writer, int64Ptr);
        }, this);
    },

    callbacksHandlerImplementation: {
        onComposeStyle: function (writer, style) {
            if (writer.id == client.id) return;
            writer.strokeRenderer.configure(style);
        },

        onComposePathPart: function (writer, path, endStroke) {
            if (writer.id == client.id) return;

            writer.compose(path, endStroke);
            writer.refresh();
        },

        onComposeAbort: function (writer) {
            if (writer.id == client.id) return;
            writer.abort();
        },

        onAdd: function (writer, strokes) {
            strokes.forEach(function (stroke) {
                WILL.strokes.push(stroke);
                writer.strokeRenderer.blendStroke(WILL.strokesLayer, stroke.blendMode);
            }, this);

            WILL.refresh();
        },

        onRemove: function (writer, group) { },

        onUpdateColor: function (writer, group, color) { },

        onUpdateBlendMode: function (writer, group, blendMode) { },

        onSplit: function (writer, splits) {},

        onTransform: function (writer, group, mat) { }
    },

};

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    //console.log('rect = ' + rect);
    //console.log('evt = ' + evt);
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}


//var env = {
//    width: top.document.getElementById(window.name).scrollWidth,
//    height: top.document.getElementById(window.name).scrollHeight
//};

//Module.addPostScript(function () {
//    Module.InkDecoder.getStrokeBrush = function (paint, writer) {
//        return WILL.brush;
//    }

//    WILL.init(env.width, env.height);
//});