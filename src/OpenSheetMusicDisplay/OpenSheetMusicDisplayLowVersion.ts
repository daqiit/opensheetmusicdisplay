import { IXmlElement } from "./../Common/FileIO/Xml";
import { VexFlowMusicSheetCalculator } from "./../MusicalScore/Graphical/VexFlow/VexFlowMusicSheetCalculator";
import { VexFlowBackend } from "./../MusicalScore/Graphical/VexFlow/VexFlowBackend";
import { MusicSheetReader } from "./../MusicalScore/ScoreIO/MusicSheetReader";
import { GraphicalMusicSheet } from "./../MusicalScore/Graphical/GraphicalMusicSheet";
import { MusicSheetCalculator } from "./../MusicalScore/Graphical/MusicSheetCalculator";
import { VexFlowMusicSheetDrawer } from "./../MusicalScore/Graphical/VexFlow/VexFlowMusicSheetDrawer";
import { SvgVexFlowBackend } from "./../MusicalScore/Graphical/VexFlow/SvgVexFlowBackend";
import { CanvasVexFlowBackend } from "./../MusicalScore/Graphical/VexFlow/CanvasVexFlowBackend";
import { MusicSheet } from "./../MusicalScore/MusicSheet";
import { Cursor } from "./Cursor";
import { MXLHelper } from "../Common/FileIO/Mxl";
import { Promise } from "es6-promise";
import { AJAX } from "./AJAX";
import * as log from "loglevel";
import { DrawingParametersEnum, DrawingParameters, ColoringModes } from "../MusicalScore/Graphical/DrawingParameters";
import { IOSMDOptions, OSMDOptions, AutoBeamOptions, BackendType } from "./OSMDOptions";
import { EngravingRules, PageFormat } from "../MusicalScore/Graphical/EngravingRules";
import { AbstractExpression } from "../MusicalScore/VoiceData/Expressions/AbstractExpression";
import { Dictionary } from "typescript-collections";
import {
    GraphicalMeasure, GraphicalStaffEntry,
    MusicSystem,
    NoteEnum,
    StaffLine,
    VexFlowMeasure,
    VexFlowMusicSystem,
    VexFlowVoiceEntry
} from "..";
import { AutoColorSet } from "../MusicalScore";
import jspdf = require("jspdf-yworks/dist/jspdf.min");
import svg2pdf = require("svg2pdf.js/dist/svg2pdf.min");
import StaveNote = Vex.Flow.StaveNote;

/**
 * The main class and control point of OpenSheetMusicDisplay.<br>
 * It can display MusicXML sheet music files in an HTML element container.<br>
 * After the constructor, use load() and render() to load and render a MusicXML file.
 */
export class OpenSheetMusicDisplayLowVersion {
    private version: string = "0.7.3-dev"; // getter: this.Version
    // at release, bump version and change to -release, afterwards to -dev again

    /**
     * Creates and attaches an OpenSheetMusicDisplay object to an HTML element container.<br>
     * After the constructor, use load() and render() to load and render a MusicXML file.
     * @param container The container element OSMD will be rendered into.<br>
     *                  Either a string specifying the ID of an HTML container element,<br>
     *                  or a reference to the HTML element itself (e.g. div)
     * @param options An object for rendering options like the backend (svg/canvas) or autoResize.<br>
     *                For defaults see the OSMDOptionsStandard method in the [[OSMDOptions]] class.
     */
    constructor(container: string | HTMLElement,
                options: IOSMDOptions = OSMDOptions.OSMDOptionsStandard()) {
        // Store container element
        if (typeof container === "string") {
            // ID passed
            this.container = document.getElementById(<string>container);
        } else if (container && "appendChild" in <any>container) {
            // Element passed
            this.container = <HTMLElement>container;
        }
        if (!this.container) {
            throw new Error("Please pass a valid div container to OpenSheetMusicDisplay");
        }

        if (options.autoResize === undefined) {
            options.autoResize = true;
        }
        this.backendType = BackendType.SVG; // default, can be changed by options
        this.setOptions(options);
    }

    public cursor: Cursor;
    public zoom: number = 1.0;

    private container: HTMLElement;
    private backendType: BackendType;
    private needBackendUpdate: boolean;
    private sheet: MusicSheet;
    private drawer: VexFlowMusicSheetDrawer;
    private drawBoundingBox: string;
    private drawSkyLine: boolean;
    private drawBottomLine: boolean;
    private graphic: GraphicalMusicSheet;
    private drawingParameters: DrawingParameters;
    private autoResizeEnabled: boolean;
    private resizeHandlerAttached: boolean;
    private followCursor: boolean;

    private offsetStaveNotes: StaveNote[] = [];
    /**
     * Load a MusicXML file
     * @param content is either the url of a file, or the root node of a MusicXML document, or the string content of a .xml/.mxl file
     */
    public load(content: string | Document): Promise<{}> {
        // Warning! This function is asynchronous! No error handling is done here.
        this.reset();
        //console.log("typeof content: " + typeof content);
        if (typeof content === "string") {

            const str: string = <string>content;
            const self: OpenSheetMusicDisplayLowVersion = this;
            if (str.substr(0, 4) === "\x50\x4b\x03\x04") {
                log.debug("[OSMD] This is a zip file, unpack it first: " + str);
                // This is a zip file, unpack it first
                return MXLHelper.MXLtoXMLstring(str).then(
                    (x: string) => {
                        return self.load(x);
                    },
                    (err: any) => {
                        log.debug(err);
                        throw new Error("OpenSheetMusicDisplay: Invalid MXL file");
                    }
                );
            }
            // Javascript loads strings as utf-16, which is wonderful BS if you want to parse UTF-8 :S
            if (str.substr(0, 3) === "\uf7ef\uf7bb\uf7bf") {
                log.debug("[OSMD] UTF with BOM detected, truncate first three bytes and pass along: " + str);
                // UTF with BOM detected, truncate first three bytes and pass along
                return self.load(str.substr(3));
            }
            if (str.substr(0, 5) === "<?xml") {
                log.debug("[OSMD] Finally parsing XML content, length: " + str.length);
                // Parse the string representing an xml file
                const parser: DOMParser = new DOMParser();
                content = parser.parseFromString(str, "application/xml");
            } else if (str.length < 2083) {
                log.debug("[OSMD] Retrieve the file at the given URL: " + str);
                // Assume now "str" is a URL
                // Retrieve the file at the given URL
                return AJAX.ajax(str).then(
                    (s: string) => { return self.load(s); },
                    (exc: Error) => { throw exc; }
                );
            } else {
                console.error("[OSMD] osmd.load(string): Could not process string. Missing else branch?");
            }
        }

        if (!content || !(<any>content).nodeName) {
            return Promise.reject(new Error("OpenSheetMusicDisplay: The document which was provided is invalid"));
        }
        const xmlDocument: Document = (<Document>content);
        const xmlDocumentNodes: NodeList = xmlDocument.childNodes;
        log.debug("[OSMD] load(), Document url: " + xmlDocument.URL);

        let scorePartwiseElement: Element;
        for (let i: number = 0, length: number = xmlDocumentNodes.length; i < length; i += 1) {
            const node: Node = xmlDocumentNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toLowerCase() === "score-partwise") {
                scorePartwiseElement = <Element>node;
                break;
            }
        }
        if (!scorePartwiseElement) {
            console.error("Could not parse MusicXML, no valid partwise element found");
            return Promise.reject(new Error("OpenSheetMusicDisplay: Document is not a valid 'partwise' MusicXML"));
        }
        const score: IXmlElement = new IXmlElement(scorePartwiseElement);
        const reader: MusicSheetReader = new MusicSheetReader();
        this.sheet = reader.createMusicSheet(score, "Untitled Score");
        if (this.sheet === undefined) {
            // error loading sheet, probably already logged, do nothing
            return Promise.reject(new Error("given music sheet was incomplete or could not be loaded."));
        }
        log.info(`[OSMD] Loaded sheet ${this.sheet.TitleString} successfully.`);

        this.needBackendUpdate = true;
        this.updateGraphic();

        return Promise.resolve({});
    }

    /**
     * (Re-)creates the graphic sheet from the music sheet
     */
    public updateGraphic(): void {
        const calc: MusicSheetCalculator = new VexFlowMusicSheetCalculator();
        this.graphic = new GraphicalMusicSheet(this.sheet, calc);
        if (this.drawingParameters.drawCursors && this.cursor) {
            this.cursor.init(this.sheet.MusicPartManager, this.graphic);
        }
    }

    /**
     * Render the music sheet in the container
     */
    public render(): void {
        if (!this.graphic) {
            throw new Error("OpenSheetMusicDisplay: Before rendering a music sheet, please load a MusicXML file");
        }
        if (this.drawer) {
            this.drawer.clear(); // clear canvas before setting width
        }
        //清除数据
        this.clauseComments.clear();
        // musicSheetCalculator.clearSystemsAndMeasures() // maybe? don't have reference though
        // musicSheetCalculator.clearRecreatedObjects();

        // Set page width
        const width: number = this.container.offsetWidth;
        //console.log("[OSMD] container width: " + width);
        this.sheet.pageWidth = width / this.zoom / 10.0;
        if (EngravingRules.Rules.PageFormat && !EngravingRules.Rules.PageFormat.IsUndefined) {
            EngravingRules.Rules.PageHeight = this.sheet.pageWidth / EngravingRules.Rules.PageFormat.aspectRatio;
        } else {
            EngravingRules.Rules.PageHeight = 100001; // infinite page height // TODO maybe Number.MAX_VALUE or Math.pow(10, 20)?
        }

        // Before introducing the following optimization (maybe irrelevant), tests
        // have to be modified to ensure that width is > 0 when executed
        //if (isNaN(width) || width === 0) {
        //    return;
        //}

        // Calculate again
        this.graphic.reCalculate();

        if (this.drawingParameters.drawCursors) {
            this.graphic.Cursors.length = 0;
        }

        // needBackendUpdate is well intentioned, but we need to cover all cases.
        //   backends also need an update when this.zoom was set from outside, which unfortunately doesn't have a setter method to set this in.
        //   so just for compatibility, we need to assume users set osmd.zoom, so we'd need to check whether it was changed compared to last time.
        if (true || this.needBackendUpdate) {
            this.createOrRefreshRenderBackend();
            this.needBackendUpdate = false;
        }

        this.drawer.setZoom(this.zoom);
        // Finally, draw
        this.drawer.drawSheet(this.graphic);

        this.enableOrDisableCursor(this.drawingParameters.drawCursors);

        if (this.drawingParameters.drawCursors && this.cursor) {
            // Update the cursor position
            this.cursor.update();
        }
        //console.log("[OSMD] render finished");
    }

    private createOrRefreshRenderBackend(): void {
        // console.log("[OSMD] createOrRefreshRenderBackend()");

        // Remove old backends
        if (this.drawer && this.drawer.Backends) {
            // removing single children to remove all is error-prone, because sometimes a random SVG-child remains.
            // for (const backend of this.drawer.Backends) {
            //     backend.removeFromContainer(this.container);
            // }
            if (this.drawer.Backends[0]) {
                this.drawer.Backends[0].removeAllChildrenFromContainer(this.container);
            }
            this.drawer.Backends.clear();
        }

        // Create the drawer
        this.drawer = new VexFlowMusicSheetDrawer(this.drawingParameters); // note that here the drawer.drawableBoundingBoxElement is lost. now saved in OSMD.
        this.drawer.drawableBoundingBoxElement = this.DrawBoundingBox;
        this.drawer.bottomLineVisible = this.drawBottomLine;
        this.drawer.skyLineVisible = this.drawSkyLine;

        // Set page width
        let width: number = this.container.offsetWidth;
        // TODO width may need to be coordinated with render() where width is also used
        let height: number;
        const canvasDimensionsLimit: number = 32767; // browser limitation. Chrome/Firefox (16 bit, 32768 causes an error).
        // Could be calculated by canvas-size module.
        // see #678 on Github and here: https://stackoverflow.com/a/11585939/10295942

        // TODO check if resize is necessary. set needResize or something when size was changed
        for (const page of this.graphic.MusicPages) {
            const backend: VexFlowBackend = this.createBackend(this.backendType);
            const sizeWarningPartTwo: string = " exceeds CanvasBackend limit of 32767. Cutting off score.";
            if (backend.getOSMDBackendType() === BackendType.Canvas && width > canvasDimensionsLimit) {
                console.log("[OSMD] Warning: width of " + width + sizeWarningPartTwo);
                width = canvasDimensionsLimit;
            }
            if (EngravingRules.Rules.PageFormat && !EngravingRules.Rules.PageFormat.IsUndefined) {
                height = width / EngravingRules.Rules.PageFormat.aspectRatio;
            } else {
                height = (page.PositionAndShape.Size.height + 15) * this.zoom * 10.0;
            }
            if (backend.getOSMDBackendType() === BackendType.Canvas && height > canvasDimensionsLimit) {
                console.log("[OSMD] Warning: height of " + height + sizeWarningPartTwo);
                height = Math.min(height, canvasDimensionsLimit); // this cuts off the the score, but doesn't break rendering.
                // TODO optional: reduce zoom to fit the score within the limit.
            }

            backend.resize(width, height);
            backend.clear(); // set bgcolor if defined (EngravingRules.Rules.PageBackgroundColor, see OSMDOptions)
            this.drawer.Backends.push(backend);
        }
    }

    /** States whether the render() function can be safely called. */
    public IsReadyToRender(): boolean {
        return this.graphic !== undefined;
    }

    /** Clears what OSMD has drawn on its canvas. */
    public clear(): void {
        this.drawer.clear();
        this.reset(); // without this, resize will draw loaded sheet again
    }

    /** Set OSMD rendering options using an IOSMDOptions object.
     *  Can be called during runtime. Also called by constructor.
     *  For example, setOptions({autoResize: false}) will disable autoResize even during runtime.
     */
    public setOptions(options: IOSMDOptions): void {
        if (!this.drawingParameters) {
            this.drawingParameters = new DrawingParameters();
        }
        if (options === undefined || options === null) {
            log.warn("warning: osmd.setOptions() called without an options parameter, has no effect."
                + "\n" + "example usage: osmd.setOptions({drawCredits: false, drawPartNames: false})");
            return;
        }
        if (options.drawingParameters) {
            this.drawingParameters.DrawingParametersEnum =
                (<any>DrawingParametersEnum)[options.drawingParameters.toLowerCase()];
        }

        const backendNotInitialized: boolean = !this.drawer || !this.drawer.Backends || this.drawer.Backends.length < 1;
        let needBackendUpdate: boolean = backendNotInitialized;
        if (options.backend !== undefined) {
            const backendTypeGiven: BackendType = OSMDOptions.BackendTypeFromString(options.backend);
            needBackendUpdate = needBackendUpdate || this.backendType !== backendTypeGiven;
            this.backendType = backendTypeGiven;
        }
        this.needBackendUpdate = needBackendUpdate;
        // TODO this is a necessary step during the OSMD constructor. Maybe move this somewhere else

        // individual drawing parameters options
        if (options.autoBeam !== undefined) { // only change an option if it was given in options, otherwise it will be undefined
            EngravingRules.Rules.AutoBeamNotes = options.autoBeam;
        }
        const autoBeamOptions: AutoBeamOptions = options.autoBeamOptions;
        if (autoBeamOptions) {
            if (autoBeamOptions.maintain_stem_directions === undefined) {
                autoBeamOptions.maintain_stem_directions = false;
            }
            EngravingRules.Rules.AutoBeamOptions = autoBeamOptions;
            if (autoBeamOptions.groups && autoBeamOptions.groups.length) {
                for (const fraction of autoBeamOptions.groups) {
                    if (fraction.length !== 2) {
                        throw new Error("Each fraction in autoBeamOptions.groups must be of length 2, e.g. [3,4] for beaming three fourths");
                    }
                }
            }
        }

        if (options.alignRests !== undefined) {
            EngravingRules.Rules.AlignRests = options.alignRests;
        }
        if (options.coloringMode !== undefined) {
            this.setColoringMode(options);
        }
        if (options.coloringEnabled !== undefined) {
            EngravingRules.Rules.ColoringEnabled = options.coloringEnabled;
        }
        if (options.colorStemsLikeNoteheads !== undefined) {
            EngravingRules.Rules.ColorStemsLikeNoteheads = options.colorStemsLikeNoteheads;
        }
        if (options.disableCursor) {
            this.drawingParameters.drawCursors = false;
        }

        // alternative to if block: this.drawingsParameters.drawCursors = options.drawCursors !== false. No if, but always sets drawingParameters.
        // note that every option can be undefined, which doesn't mean the option should be set to false.
        if (options.drawHiddenNotes) {
            this.drawingParameters.drawHiddenNotes = true;
        }
        if (options.drawCredits !== undefined) {
            this.drawingParameters.DrawCredits = options.drawCredits; // sets DrawComposer, DrawTitle, DrawSubtitle, DrawLyricist.
        }
        if (options.drawComposer !== undefined) {
            this.drawingParameters.DrawComposer = options.drawComposer;
        }
        if (options.drawTitle !== undefined) {
            this.drawingParameters.DrawTitle = options.drawTitle;
        }
        if (options.drawSubtitle !== undefined) {
            this.drawingParameters.DrawSubtitle = options.drawSubtitle;
        }
        if (options.drawLyricist !== undefined) {
            this.drawingParameters.DrawLyricist = options.drawLyricist;
        }
        if (options.drawPartNames !== undefined) {
            this.drawingParameters.DrawPartNames = options.drawPartNames; // indirectly writes to EngravingRules
        }
        if (options.drawPartAbbreviations !== undefined) {
            EngravingRules.Rules.RenderPartAbbreviations = options.drawPartAbbreviations;
        }
        if (options.drawFingerings === false) {
            EngravingRules.Rules.RenderFingerings = false;
        }
        if (options.drawMeasureNumbers !== undefined) {
            EngravingRules.Rules.RenderMeasureNumbers = options.drawMeasureNumbers;
        }
        if (options.drawLyrics !== undefined) {
            EngravingRules.Rules.RenderLyrics = options.drawLyrics;
        }
        if (options.drawSlurs !== undefined) {
            EngravingRules.Rules.RenderSlurs = options.drawSlurs;
        }
        if (options.measureNumberInterval !== undefined) {
            EngravingRules.Rules.MeasureNumberLabelOffset = options.measureNumberInterval;
        }
        if (options.fingeringPosition !== undefined) {
            EngravingRules.Rules.FingeringPosition = AbstractExpression.PlacementEnumFromString(options.fingeringPosition);
        }
        if (options.fingeringInsideStafflines !== undefined) {
            EngravingRules.Rules.FingeringInsideStafflines = options.fingeringInsideStafflines;
        }
        if (options.fillEmptyMeasuresWithWholeRest !== undefined) {
            EngravingRules.Rules.FillEmptyMeasuresWithWholeRest = options.fillEmptyMeasuresWithWholeRest;
        }
        if (options.followCursor !== undefined) {
            this.FollowCursor = options.followCursor;
        }
        if (options.setWantedStemDirectionByXml !== undefined) {
            EngravingRules.Rules.SetWantedStemDirectionByXml = options.setWantedStemDirectionByXml;
        }
        if (options.defaultColorNotehead) {
            EngravingRules.Rules.DefaultColorNotehead = options.defaultColorNotehead;
        }
        if (options.defaultColorRest) {
            EngravingRules.Rules.DefaultColorRest = options.defaultColorRest;
        }
        if (options.defaultColorStem) {
            EngravingRules.Rules.DefaultColorStem = options.defaultColorStem;
        }
        if (options.defaultColorLabel) {
            EngravingRules.Rules.DefaultColorLabel = options.defaultColorLabel;
        }
        if (options.defaultColorTitle) {
            EngravingRules.Rules.DefaultColorTitle = options.defaultColorTitle;
        }
        if (options.defaultFontFamily) {
            EngravingRules.Rules.DefaultFontFamily = options.defaultFontFamily; // default "Times New Roman", also used if font family not found
        }
        if (options.drawUpToMeasureNumber) {
            EngravingRules.Rules.MaxMeasureToDrawIndex = options.drawUpToMeasureNumber - 1;
        }
        if (options.drawFromMeasureNumber) {
            EngravingRules.Rules.MinMeasureToDrawIndex = options.drawFromMeasureNumber - 1;
        }
        if (options.tupletsRatioed) {
            EngravingRules.Rules.TupletsRatioed = true;
        }
        if (options.tupletsBracketed) {
            EngravingRules.Rules.TupletsBracketed = true;
        }
        if (options.tripletsBracketed) {
            EngravingRules.Rules.TripletsBracketed = true;
        }
        if (options.autoResize) {
            if (!this.resizeHandlerAttached) {
                this.autoResize();
            }
            this.autoResizeEnabled = true;
        } else if (options.autoResize === false) { // not undefined
            this.autoResizeEnabled = false;
            // we could remove the window EventListener here, but not necessary.
        }
        if (options.pageFormat !== undefined) { // only change this option if it was given, see above
            EngravingRules.Rules.PageFormat = OpenSheetMusicDisplayLowVersion.StringToPageFormat(options.pageFormat);
        }
        if (options.pageBackgroundColor !== undefined) {
            EngravingRules.Rules.PageBackgroundColor = options.pageBackgroundColor;
        }
    }

    public setColoringMode(options: IOSMDOptions): void {
        if (options.coloringMode === ColoringModes.XML) {
            EngravingRules.Rules.ColoringMode = ColoringModes.XML;
            return;
        }
        const noteIndices: NoteEnum[] = [NoteEnum.C, NoteEnum.D, NoteEnum.E, NoteEnum.F, NoteEnum.G, NoteEnum.A, NoteEnum.B, -1];
        let colorSetString: string[];
        if (options.coloringMode === ColoringModes.CustomColorSet) {
            if (!options.coloringSetCustom || options.coloringSetCustom.length !== 8) {
                throw new Error("Invalid amount of colors: With coloringModes.customColorSet, " +
                    "you have to provide a coloringSetCustom parameter with 8 strings (C to B, rest note).");
            }
            // validate strings input
            for (const colorString of options.coloringSetCustom) {
                const regExp: RegExp = /^\#[0-9a-fA-F]{6}$/;
                if (!regExp.test(colorString)) {
                    throw new Error(
                        "One of the color strings in options.coloringSetCustom was not a valid HTML Hex color:\n" + colorString);
                }
            }
            colorSetString = options.coloringSetCustom;
        } else if (options.coloringMode === ColoringModes.AutoColoring) {
            colorSetString = [];
            const keys: string[] = Object.keys(AutoColorSet);
            for (let i: number = 0; i < keys.length; i++) {
                colorSetString.push(AutoColorSet[keys[i]]);
            }
        } // for both cases:
        const coloringSetCurrent: Dictionary<NoteEnum | number, string> = new Dictionary<NoteEnum | number, string>();
        for (let i: number = 0; i < noteIndices.length; i++) {
            coloringSetCurrent.setValue(noteIndices[i], colorSetString[i]);
        }
        coloringSetCurrent.setValue(-1, colorSetString[7]);
        EngravingRules.Rules.ColoringSetCurrent = coloringSetCurrent;

        EngravingRules.Rules.ColoringMode = options.coloringMode;
    }

    /**
     * Sets the logging level for this OSMD instance. By default, this is set to `warn`.
     *
     * @param: content can be `trace`, `debug`, `info`, `warn` or `error`.
     */
    public setLogLevel(level: string): void {
        switch (level) {
            case "trace":
                log.setLevel(log.levels.TRACE);
                break;
            case "debug":
                log.setLevel(log.levels.DEBUG);
                break;
            case "info":
                log.setLevel(log.levels.INFO);
                break;
            case "warn":
                log.setLevel(log.levels.WARN);
                break;
            case "error":
                log.setLevel(log.levels.ERROR);
                break;
            default:
                log.warn(`Could not set log level to ${level}. Using warn instead.`);
                log.setLevel(log.levels.WARN);
                break;
        }
    }

    public getLogLevel(): number {
        return log.getLevel();
    }

    /**
     * Initialize this object to default values
     * FIXME: Probably unnecessary
     */
    private reset(): void {
        if (this.drawingParameters.drawCursors && this.cursor) {
            this.cursor.hide();
        }
        this.sheet = undefined;
        this.graphic = undefined;
        this.zoom = 1.0;
    }

    /**
     * Attach the appropriate handler to the window.onResize event
     */
    private autoResize(): void {

        const self: OpenSheetMusicDisplayLowVersion = this;
        this.handleResize(
            () => {
                // empty
            },
            () => {
                // The following code is probably not needed
                // (the width should adapt itself to the max allowed)
                //let width: number = Math.max(
                //    document.documentElement.clientWidth,
                //    document.body.scrollWidth,
                //    document.documentElement.scrollWidth,
                //    document.body.offsetWidth,
                //    document.documentElement.offsetWidth
                //);
                //self.container.style.width = width + "px";
                if (self.IsReadyToRender()) {
                    self.render();
                }
            }
        );
    }

    /**
     * Helper function for managing window's onResize events
     * @param startCallback is the function called when resizing starts
     * @param endCallback is the function called when resizing (kind-of) ends
     */
    private handleResize(startCallback: () => void, endCallback: () => void): void {
        let rtime: number;
        let timeout: number = undefined;
        const delta: number = 200;
        const self: OpenSheetMusicDisplayLowVersion = this;

        function resizeStart(): void {
            if (!self.AutoResizeEnabled) {
                return;
            }
            rtime = (new Date()).getTime();
            if (!timeout) {
                startCallback();
                rtime = (new Date()).getTime();
                timeout = window.setTimeout(resizeEnd, delta);
            }
        }

        function resizeEnd(): void {
            timeout = undefined;
            window.clearTimeout(timeout);
            if ((new Date()).getTime() - rtime < delta) {
                timeout = window.setTimeout(resizeEnd, delta);
            } else {
                endCallback();
            }
        }

        if ((<any>window).attachEvent) {
            // Support IE<9
            (<any>window).attachEvent("onresize", resizeStart);
        } else {
            window.addEventListener("resize", resizeStart);
        }
        this.resizeHandlerAttached = true;

        window.setTimeout(startCallback, 0);
        window.setTimeout(endCallback, 1);
    }

    /** Enable or disable (hide) the cursor.
     * @param enable whether to enable (true) or disable (false) the cursor
     */
    public enableOrDisableCursor(enable: boolean): void {
        this.drawingParameters.drawCursors = enable;
        if (enable) {
            this.cursor = new Cursor(this.drawer.Backends[0].getInnerElement(), this);
            if (this.sheet && this.graphic) { // else init is called in load()
                this.cursor.init(this.sheet.MusicPartManager, this.graphic);
            }
        } else { // disable cursor
            if (!this.cursor) {
                return;
            }
            this.cursor.hide();
            // this.cursor = undefined;
            // TODO cursor should be disabled, not just hidden. otherwise user can just call osmd.cursor.hide().
            // however, this could cause null calls (cursor.next() etc), maybe that needs some solution.
        }
    }

    public createBackend(type: BackendType): VexFlowBackend {
        let backend: VexFlowBackend;
        if (type === undefined || type === BackendType.SVG) {
            backend = new SvgVexFlowBackend();
        } else {
            backend = new CanvasVexFlowBackend();
        }
        backend.initialize(this.container);
        return backend;
    }

    /** Standard page format options like A4 or Letter, in portrait and landscape. E.g. PageFormatStandards["A4_P"] or PageFormatStandards["Letter_L"]. */
    public static PageFormatStandards: {[type: string]: PageFormat} = {
        "A3_L": new PageFormat(420, 297, "A3_L"), // id strings should use underscores instead of white spaces to facilitate use as URL parameters.
        "A3_P": new PageFormat(297, 420, "A3_P"),
        "A4_L": new PageFormat(297, 210, "A4_L"),
        "A4_P": new PageFormat(210, 297, "A4_P"),
        "A5_L": new PageFormat(210, 148, "A5_L"),
        "A5_P": new PageFormat(148, 210, "A5_P"),
        "A6_L": new PageFormat(148, 105, "A6_L"),
        "A6_P": new PageFormat(105, 148, "A6_P"),
        "Endless": PageFormat.UndefinedPageFormat,
        "Letter_L": new PageFormat(279.4, 215.9, "Letter_L"),
        "Letter_P": new PageFormat(215.9, 279.4, "Letter_P")
    };

    public static StringToPageFormat(formatId: string): PageFormat {
        formatId = formatId.replace(" ", "_");
        formatId = formatId.replace("Landscape", "L");
        formatId = formatId.replace("Portrait", "P");
        //console.log("change format to: " + formatId);
        let f: PageFormat = PageFormat.UndefinedPageFormat; // default: 'endless' page height, take canvas/container width
        if (OpenSheetMusicDisplayLowVersion.PageFormatStandards.hasOwnProperty(formatId)) {
            f = OpenSheetMusicDisplayLowVersion.PageFormatStandards[formatId];
        }
        return f;
    }

    /** Sets page format by string. Alternative to setOptions({pageFormat: PageFormatStandards.Endless}) for example. */
    public setPageFormat(formatId: string): void {
        const newPageFormat: PageFormat = OpenSheetMusicDisplayLowVersion.StringToPageFormat(formatId);
        this.needBackendUpdate = !(newPageFormat.Equals(EngravingRules.Rules.PageFormat));
        EngravingRules.Rules.PageFormat = newPageFormat;
    }

    public setCustomPageFormat(width: number, height: number): void {
        if (width > 0 && height > 0) {
            const f: PageFormat = new PageFormat(width, height);
            EngravingRules.Rules.PageFormat = f;
        }
    }

    /**
     * Creates a Pdf of the currently rendered MusicXML
     * @param pdfName if no name is given, the composer and title of the piece will be used
     */
    public createPdf(pdfName: string = undefined): void {
        if (this.backendType !== BackendType.SVG) {
            console.log("[OSMD] osmd.createPdf(): Warning: createPDF is only supported for SVG background for now, not for Canvas." +
                " Please use osmd.setOptions({backendType: SVG}).");
            return;
        }

        if (pdfName === undefined) {
            pdfName = this.sheet.FullNameString + ".pdf";
        }

        const backends: VexFlowBackend[] =  this.drawer.Backends;
        let svgElement: SVGElement = (<SvgVexFlowBackend>backends[0]).getSvgElement();

        let pageWidth: number = 210;
        let pageHeight: number = 297;
        const engravingRulesPageFormat: PageFormat = EngravingRules.Rules.PageFormat;
        if (engravingRulesPageFormat && !engravingRulesPageFormat.IsUndefined) {
            pageWidth = engravingRulesPageFormat.width;
            pageHeight = engravingRulesPageFormat.height;
        } else {
            pageHeight = pageWidth * svgElement.clientHeight / svgElement.clientWidth;
        }

        const orientation: string = pageHeight > pageWidth ? "p" : "l";
        // create a new jsPDF instance
        const pdf: any = new jspdf(orientation, "mm", [pageWidth, pageHeight]);
        const scale: number = pageWidth / svgElement.clientWidth;
        for (let idx: number = 0, len: number = backends.length; idx < len; ++idx) {
            if (idx > 0) {
                pdf.addPage();
            }
            svgElement = (<SvgVexFlowBackend>backends[idx]).getSvgElement();

            // render the svg element
            svg2pdf(svgElement, pdf, {
                scale: scale,
                xOffset: 0,
                yOffset: 0
            });
        }

        // simply save the created pdf
        pdf.save(pdfName);
    }

    //#region GETTER / SETTER
    public set DrawSkyLine(value: boolean) {
        this.drawSkyLine = value;
        if (this.drawer) {
            this.drawer.skyLineVisible = value;
            this.render();
        }
    }
    public get DrawSkyLine(): boolean {
        return this.drawer.skyLineVisible;
    }

    public set DrawBottomLine(value: boolean) {
        this.drawBottomLine = value;
        if (this.drawer) {
            this.drawer.bottomLineVisible = value;
            this.render();
        }
    }
    public get DrawBottomLine(): boolean {
        return this.drawer.bottomLineVisible;
    }

    public set DrawBoundingBox(value: string) {
        this.drawBoundingBox = value;
        this.drawer.drawableBoundingBoxElement = value; // drawer is sometimes created anew, losing this value, so it's saved in OSMD now.
        this.render(); // may create new Drawer.
    }
    public get DrawBoundingBox(): string {
        return this.drawBoundingBox;
    }

    public get AutoResizeEnabled(): boolean {
        return this.autoResizeEnabled;
    }
    public set AutoResizeEnabled(value: boolean) {
        this.autoResizeEnabled = value;
    }

    public set FollowCursor(value: boolean) {
        this.followCursor = value;
    }

    public get FollowCursor(): boolean {
        return this.followCursor;
    }

    public get Sheet(): MusicSheet {
        return this.sheet;
    }
    public get Drawer(): VexFlowMusicSheetDrawer {
        return this.drawer;
    }
    public get GraphicSheet(): GraphicalMusicSheet {
        return this.graphic;
    }
    public get DrawingParameters(): DrawingParameters {
        return this.drawingParameters;
    }
    public get EngravingRules(): EngravingRules { // custom getter, useful for engraving parameter setting in Demo
        return EngravingRules.Rules;
    }
    /** Returns the version of OSMD this object is built from (the version you are using). */
    public get Version(): string {
        return this.version;
    }
    //#endregion


    // # region xiaoqingtong中使用的方法
    ///重新渲染分节的某个音符
    public  UpdateDrawKeyOfMeasure(measureIndex: number, groupIndex: number, staffIndex: number, voiceIndex: number, noteIndex: number, noteheadColor: string): void {
        const currentVexFlowMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex][groupIndex] as VexFlowMeasure;
        const gev1: VexFlowVoiceEntry = currentVexFlowMeasure.staffEntries[staffIndex].graphicalVoiceEntries[voiceIndex] as VexFlowVoiceEntry;

        for (const item of gev1.notes) {
            item.sourceNote.NoteheadColor = noteheadColor;
        }
        //  gev1.notes[noteIndex].sourceNote.NoteheadColor = noteheadColor;
        gev1.color();
        const stemStyle: Object = { fillStyle: noteheadColor, strokeStyle: noteheadColor };
        const staveNote: Vex.Flow.StaveNote = (gev1.vfStaveNote as Vex.Flow.StaveNote);
        staveNote.setStemStyle(stemStyle);
        //修改有连音符的情况
        if ( staveNote.getBeamCount() > 0 ) {
            for (const voiceID in currentVexFlowMeasure.getVFStave()) {
                if (currentVexFlowMeasure.getVFStave.hasOwnProperty(voiceID)) {
                    for (const beam of currentVexFlowMeasure.getVFStave[voiceID]) {
                        if (beam.getNotes().contains(staveNote)) {
                            beam.setContext(this.drawer.Backends[0].getContext()).draw();
                        }
                    }
                }
            }
        }
        //避免与偏移渲染冲突
        staveNote.getStem().hide = false;
        staveNote.setXShift(0);
        staveNote.draw();
    }
    public  changeNoteColor(measureIndex: number, groupIndex: number, staffIndex: number, voiceIndex: number, noteIndex: number, noteheadColor: string): void {
        try {
            const currentVexFlowMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex][groupIndex] as VexFlowMeasure;
            const gev1: VexFlowVoiceEntry = currentVexFlowMeasure.staffEntries[staffIndex].graphicalVoiceEntries[voiceIndex] as VexFlowVoiceEntry;
            const staveNote: any = (gev1.vfStaveNote as any);
            const vfNote: any = staveNote.note_heads[noteIndex];
            vfNote.setStyle({ fillStyle: noteheadColor, strokeStyle: noteheadColor});
            vfNote.draw();
        } catch (e) {
            console.log(e);
        }

    }
    ///渲染偏移的音符
    // tslint:disable-next-line:max-line-length
    public  OffsetDrawKeyOfMeasure(measureIndex: number, groupIndex: number, staffIndex: number, voiceIndex: number, noteIndex: number,  offset: number): void {
        const currentVexFlowMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex][groupIndex] as VexFlowMeasure;
        const gev1: VexFlowVoiceEntry = currentVexFlowMeasure.staffEntries[staffIndex].graphicalVoiceEntries[voiceIndex] as VexFlowVoiceEntry;
        // const  noteheadColor: string = "#fd919180";
        const  noteheadColor: string = "rgba(253,145,145,0.7)";
        for (const item of gev1.notes) {
            item.sourceNote.NoteheadColor = noteheadColor;
        }
        //  gev1.notes[noteIndex].sourceNote.NoteheadColor = noteheadColor;
        gev1.color();
        const stemStyle: Object = { fillStyle: noteheadColor, strokeStyle: noteheadColor };
        const staveNote: Vex.Flow.StaveNote = (gev1.vfStaveNote as Vex.Flow.StaveNote);
        staveNote.setStemStyle(stemStyle);
        this.offsetStaveNotes.push(staveNote);
        staveNote.setXShift(offset);
        staveNote.getStem().hide = true;
        staveNote.draw();
    }
    ///移除偏移的音符
    public removeOffsetStaveNotes(): void {
        for (const staveNote of this.offsetStaveNotes) {
            staveNote.setXShift(0);
        }
        const svgnode:  Element = document.body.getElementsByTagName("svg")[0];
        const nodes:  HTMLCollection = svgnode.children;
        const offsetStaveNotesCount: number= this.offsetStaveNotes.length-1 ;
        for(let i: number = offsetStaveNotesCount; i >= 0; i--){

            for (let j: number = nodes.length - 1; j > 0; j--) {
                if (nodes[j].getAttribute("id")!=null && (nodes[j].getAttribute("id") ==="vf-"+ this.offsetStaveNotes[i].getAttribute("id"))) {
                    svgnode.removeChild(nodes[j]);
                    break;
                }

            }
        }
        this.offsetStaveNotes.clear();
    }

    ///给某个音符添加注释
    public AddNoteComment(measureIndex: number, groupIndex: number, staffIndex: number, voiceIndex: number, noteIndex: number): void {
        const currentVexFlowMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex][groupIndex] as VexFlowMeasure;
        const gev1: VexFlowVoiceEntry = currentVexFlowMeasure.staffEntries[staffIndex].graphicalVoiceEntries[voiceIndex] as VexFlowVoiceEntry;
        (gev1.vfStaveNote as Vex.Flow.StaveNote).addModifier(0,  new Vex.Flow.Bend("注释"));
        (gev1.vfStaveNote as Vex.Flow.StaveNote).preFormat();
        (gev1.vfStaveNote as Vex.Flow.StaveNote).drawModifiers();
    }
    ///重新渲染所有的分节
    public  redrawAllMeasure(): void {
        const measures: VexFlowMeasure[][] = this.graphic.MeasureList as VexFlowMeasure[][];
        for ( const measure of measures) {
            for ( const item of measure) {
                item.draw(this.drawer.Backends[0].getContext());
            }
        }
    }
    ///重新渲染分节measurStart到measureEnd
    public  redrawMeasure(startMeasurIndex: number , endMeasureIndex: number): void {
        const measures: VexFlowMeasure[][] = this.graphic.MeasureList as VexFlowMeasure[][];
        for ( const measure of measures) {
            for ( const item of measure) {
                if (item.MeasureNumber >= startMeasurIndex + 1 && item.MeasureNumber <= endMeasureIndex + 1) {
                    item.draw(this.drawer.Backends[0].getContext());
                }
            }
        }
    }

    ///根据voice来添加注释区域
    public addCommentAreaByVoiceEntry(startMeasureIndex: number, startGroupIndex: number, startStaffIndex: number, startVoiceIndex: number,
                                      endMeasureIndex: number, endGroupIndex: number, endStaffIndex: number, endVoiceIndex: number, word: string,
                                      isAddBorder: boolean = false): void {
        const startMeasure: VexFlowMeasure = <VexFlowMeasure> this.graphic.MeasureList[startMeasureIndex][startGroupIndex];
        // tslint:disable-next-line:max-line-length
        const startVoice: VexFlowVoiceEntry = <VexFlowVoiceEntry> startMeasure.staffEntries[startStaffIndex].graphicalVoiceEntries[startVoiceIndex];
        const endMeasure: GraphicalMeasure = this.graphic.MeasureList[endMeasureIndex][endGroupIndex];
        // tslint:disable-next-line:max-line-length
        const endVoice: VexFlowVoiceEntry = <VexFlowVoiceEntry> endMeasure.staffEntries[endStaffIndex].graphicalVoiceEntries[endVoiceIndex];
        const startIndex: number = startMeasure.parentMusicSystem.Id;
        const endIndex: number = endMeasure.parentMusicSystem.Id;
        //可能一个区域分布在多行musicsystem上

        for (let i: number = startIndex; i <= endIndex ; i++ ) {
            let startX: number = 0;
            let endX: number = 0;
            const currentMusicSystem: MusicSystem = this.graphic.MusicPages[0].MusicSystems[i];
            if ( i === startIndex) {
                startX = startVoice.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom;
            } else {
                for ( const graphicalMeasure of currentMusicSystem.GraphicalMeasures) {
                    for ( const graphicalMeasureItem of graphicalMeasure) {
                        if ( startX === 0 || graphicalMeasureItem.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom < startX) {
                            startX = graphicalMeasureItem.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom;
                        }
                    }
                }
            }
            if ( i === endIndex) {
                endX = endVoice.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom;
            } else {
                endX =  currentMusicSystem.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom
                    + currentMusicSystem.PositionAndShape.Size.width * 10.0 * this.zoom;
            }
            if ( isAddBorder ) {
                const y: number = currentMusicSystem.PositionAndShape.AbsolutePosition.y + currentMusicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
                const bottomStaffline: StaffLine = currentMusicSystem.StaffLines[currentMusicSystem.StaffLines.length - 1];
                const endY: number = currentMusicSystem.PositionAndShape.AbsolutePosition.y +
                    bottomStaffline.PositionAndShape.RelativePosition.y + bottomStaffline.PositionAndShape.RelativePosition.y;
                this.addCommentArea(startX, currentMusicSystem.PositionAndShape.AbsolutePosition.y * 10.0 * this.zoom, endX, (endY - y) * 10.0 * this.zoom);
            }
            this.addCommentText(startX, currentMusicSystem.PositionAndShape.AbsolutePosition.y * 10.0 * this.zoom,
                endX, this.cursor.cursorElement.height  * 10.0 * this.zoom, word);
        }
    }
    ///添加分句注释
    public addClauseComment(measureIndex: number, clauseNum: number): void {
        const currentMeasure: GraphicalMeasure =  this.graphic.MeasureList[measureIndex][0];
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        const input: HTMLElement = document.createElement("input");
        const height: number = 12 * 10.0 * this.zoom;
        input.className = "measureComment";
        input.style.position = "absolute";
        input.style.zIndex = "5";
        input.style.fontSize = height * 0.15 + "px";
        // input.style.backgroundColor = "#ffeeea";
        input.style.backgroundColor = "#FF6647";
        input.style.color = "#ffffff";
        input.style.border = "0";
        input.style.borderRadius =  height * 0.2 + "px";
        input.style.textAlign = "center";
        const inputElement: HTMLInputElement = <HTMLInputElement>input;
        inputElement.type = "button";
        inputElement.value = "第" + clauseNum + "分句" ;
        inputElement.style.top = currentMeasure.PositionAndShape.AbsolutePosition.y * 10.0 * this.zoom - height * 0.5 + "px";
        inputElement.style.left = currentMeasure.PositionAndShape.AbsolutePosition.x * 10.0 * this.zoom + "px";
        container.appendChild(input);
    }
    public clauseComments: number[]=[];
    ///添加多个的分句备注
    public addMultipleClauseComment(measureStartIndexes: number[]): void {
        if (measureStartIndexes !== null) {
            for (let i: number = 0; i < measureStartIndexes.length; i++) {
                if(!this.clauseComments.contains(measureStartIndexes[i])){
                    this.clauseComments.push(measureStartIndexes[i]);
                    this.addClauseComment(measureStartIndexes[i], i + 1);
                }
            }
        }
    }
    ///移除全部的分句备注
    public removeAllClauseComment(): void {
        const elements: HTMLCollectionOf<Element> = document.getElementsByClassName("measureComment");
        while (elements.length > 0) {
            elements[0].parentElement.removeChild(elements[0]);
        }
        this.clauseComments.clear();
    }
    ///添加注释区域
    public addCommentArea(startX: number, startY: number, endX: number, height: number): void {
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        const commentDiv: HTMLElement = document.createElement("div");
        commentDiv.className = "commentArea";
        commentDiv.style.position = "absolute";
        commentDiv.style.backgroundColor = "#ffeeea";
        commentDiv.style.zIndex = "-2";
        commentDiv.style.boxSizing = "content-box";
        commentDiv.style.border = height * 0.1 + "px double #000000";
        commentDiv.style.borderImage = "url(images/comment_area_bg.png) 18 stretch";

        const commentDivElement: HTMLDivElement = <HTMLDivElement>commentDiv;
        //定位
        commentDivElement.style.top = startY - height * 0.1 + "px";
        commentDivElement.style.left = startX - height * 0.1 + "px";
        commentDivElement.style.width = (endX - startX)  + "px";
        commentDivElement.style.height = height  + "px";
        //样式修改
        container.appendChild(commentDiv);
    }
    ///添加文本注释
    public addCommentText(startX: number, startY: number, endX: number, height: number, word: string): void {
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        const input: HTMLElement = document.createElement("input");
        input.className = "commentText";
        input.style.position = "absolute";
        input.style.zIndex = "-2";
        input.style.backgroundColor = "#ff564b";
        input.style.color = "#ffffff";
        input.style.border = "0";
        input.style.borderRadius =  height * 0.1 + "px";
        input.style.width = height * 0.6 + "px";
        input.style.height = height * 0.2 + "px";
        const inputElement: HTMLInputElement = <HTMLInputElement>input;
        inputElement.type = "button";
        inputElement.value = word;
        inputElement.style.top = startY - height * 0.4 + "px";
        inputElement.style.left = startX + (endX - startX)  / 2 - height * 0.3  + "px";
        container.appendChild(input);
    }
    ///清除所有注释
    public clearCommentArea(): void {
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        const comentAreas:  NodeListOf<Element> = container.getElementsByClassName("commentArea");
        //清除区域框选
        while (comentAreas.length > 0) {
            container.removeChild(comentAreas[0]);
        }
        //清除文字
        const commentTexts: NodeListOf<Element> = container.getElementsByClassName("commentText");
        while (commentTexts.length > 0) {
            container.removeChild(commentTexts[0]);
        }

    }



    public drawMeasureBackGround(startMeasureIndex: number, endMeasureIndex: number, color?: string): void {

        if (color !== null && color !== "" && color !== undefined) {
            for (let i: number = startMeasureIndex; i <= endMeasureIndex; i++) {
                this.drawerMeasureBackground(i, color);
            }
        }
    }
    public clearAllMeasureBackGround(): void {

        const elements: HTMLCollectionOf<Element> = document.getElementsByClassName("measureBackgroundImg");
        while (elements.length > 0) {
            elements[0].parentElement.removeChild(elements[0]);
        }
    }
    private drawerMeasureBackground(measureIndex: number, color: string): void {
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        // tslint:disable-next-line:typedef
        const currentMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex].last() as VexFlowMeasure;
        const musicSystem: VexFlowMusicSystem = currentMeasure.parentMusicSystem as VexFlowMusicSystem;
        const stave: Vex.Flow.Stave = currentMeasure.getVFStave();
        if (stave) {

            // find unique measureBackground id in document
            const measureImg: HTMLElement = document.createElement("img");
            measureImg.style.position = "absolute";
            measureImg.style.zIndex = "-2";
            measureImg.className = "measureBackgroundImg";
            this.container.appendChild(measureImg);
            // tslint:disable-next-line:typedef
            const measureBackgroundElement: HTMLImageElement = <HTMLImageElement>measureImg;

            measureBackgroundElement.style.left = (stave.getX()  * this.zoom) + "px";
            measureBackgroundElement.width = (stave.getWidth() * this.zoom);

            const bottomStaffline: StaffLine = musicSystem.StaffLines[musicSystem.StaffLines.length - 1];
            // tslint:disable-next-line:typedef
            const y: number = musicSystem.PositionAndShape.AbsolutePosition.y + musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
            const endY: number = musicSystem.PositionAndShape.AbsolutePosition.y +
                bottomStaffline.PositionAndShape.RelativePosition.y + bottomStaffline.PositionAndShape.RelativePosition.y;
            measureBackgroundElement.height  = ((endY - y) * 10.0 * this.zoom);
            measureBackgroundElement.style.top = (y * 10.0 * this.zoom) + "px";

            //构建填充
            const c: HTMLCanvasElement = document.createElement("canvas");
            c.width = measureBackgroundElement.width;
            c.height = 1;
            const ctx: CanvasRenderingContext2D = c.getContext("2d");
            ctx.globalAlpha = 1;
            // Generate the gradient
            const gradient: CanvasGradient = ctx.createLinearGradient(0, 0, measureBackgroundElement.width, 0);

            gradient.addColorStop(1, color);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, measureBackgroundElement.width, 1);
            measureBackgroundElement.src = c.toDataURL("image/png");
            container.appendChild(measureBackgroundElement);
        }


    }

    ///添加卡标签
    public addStuckText(measureIndex: number, groupIndex: number, staffIndex: number): void {
        // tslint:disable-next-line:max-line-length
        const graphicalStaffEntry: GraphicalStaffEntry = <GraphicalStaffEntry> this.graphic.MeasureList[measureIndex][groupIndex].staffEntries[staffIndex];
        const container: HTMLElement = this.drawer.Backends[0].getInnerElement();
        // tslint:disable-next-line:max-line-length
        const input: HTMLElement = document.createElement("input");
        const height: number = 5 * 10.0 * this.zoom;
        input.style.position = "absolute";
        input.className = "stuckComment";
        input.style.zIndex = "5";
        input.style.fontSize = height * 0.1 + "px";
        // input.style.backgroundColor = "#ffeeea";
        input.style.backgroundColor = "#FF6647";
        input.style.color = "#ffffff";
        input.style.border = "0";
        input.style.borderRadius =  height * 0.2 + "px";
        input.style.textAlign = "center";
        const inputElement: HTMLInputElement = <HTMLInputElement>input;
        inputElement.type = "button";
        inputElement.value = "卡" ;
        inputElement.style.top = (graphicalStaffEntry.PositionAndShape.AbsolutePosition.y - 2.5 ) * 10.0 * this.zoom + "px";
        inputElement.style.left = ((graphicalStaffEntry.PositionAndShape.AbsolutePosition.x - 1.5 ) * 10.0 * this.zoom  ) + "px";
        console.log( inputElement.style.width.slice(0 , inputElement.style.width.length - 2 ));
        console.log( parseFloat(inputElement.style.width.substring(0 , inputElement.style.width.length - 2 )));
        console.log(inputElement.style.left);
        container.appendChild(input);
    }
    ///异常全部的分句备注
    public removeAllStuckComment(): void {
        const elements: HTMLCollectionOf<Element> = document.getElementsByClassName("stuckComment");
        while (elements.length > 0) {
            elements[0].parentElement.removeChild(elements[0]);
        }
    }
}
