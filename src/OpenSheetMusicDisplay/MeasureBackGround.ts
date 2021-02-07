import {OpenSheetMusicDisplay} from "./OpenSheetMusicDisplay";
import {GraphicalMusicSheet, StaffLine, VexFlowMeasure, VexFlowMusicSystem} from "../MusicalScore/Graphical";
import {MusicPartManager, } from "../MusicalScore/MusicParts";


export class MeasureBackGround1 {
    constructor(container: HTMLElement, openSheetMusicDisplay: OpenSheetMusicDisplay) {
        this.container = container;
        this.openSheetMusicDisplay = openSheetMusicDisplay;
        this.measureBackgroundElements = [];
        // set measureBackground id
        // TODO add this for the OSMD object as well and refactor this into a util method?

    }
    private container: HTMLElement;
    public measureBackgroundElements: HTMLImageElement[];
    public measureBackgroundElementId: string;
    private openSheetMusicDisplay: OpenSheetMusicDisplay;
    private graphic: GraphicalMusicSheet;
    public hidden: boolean = true;

    public startMeasureIndex: number;
    public endMeasureIndex: number;
    public color: string;
    //  private manager: MusicPartManager;
    /** Initialize the cursor. Necessary before using functions like show() and next(). */
    public init(manager: MusicPartManager, graphic: GraphicalMusicSheet): void {
        //this.manager = manager;
        this.graphic = graphic;
        //this.reset();
        this.hidden = true;
        this.hide();
    }
    /**
     * Hide the cursor
     */
    public hide(): void {
        // Hide the actual cursor element
        for (const measureBackgroundElement of this.measureBackgroundElements) {
            measureBackgroundElement.style.display = "none";
        }

        //this.graphic.Cursors.length = 0;
        // Forcing the sheet to re-render is not necessary anymore
        //if (!this.hidden) {
        //    this.openSheetMusicDisplay.render();
        //}
        this.hidden = true;
    }
    public update(startMeasureIndex: number, endMeasureIndex: number, color?: string): void {
        this.clear();
        //颜色没有就不用修改背景
        if (color !== null && color !== "" && color !== undefined) {
           for (let i: number = startMeasureIndex; i <= endMeasureIndex; i++) {
               this.drawerMeasureBackground(i, color);
           }
       }
        if ( endMeasureIndex > this.graphic.MeasureList.length - 1) {
            endMeasureIndex = this.graphic.MeasureList.length - 1;
        }
        //添加开始和结束标记
       // this.addMeasureStartAndEndTag(startMeasureIndex, endMeasureIndex);
    }
    //清除所有的背景
    public clear (): void {
       // const parent:  Element = document.body.getElementsByTagName("svg")[0].parentElement;
        const elements: HTMLCollectionOf<Element> = document.getElementsByClassName("measureBackgroundImg");
        while (elements.length > 0) {
            elements[0].parentElement.removeChild(elements[0]);
        }

        this.measureBackgroundElements.clear();
    }
    /**
     * Make the cursor visible.包含开始和结束,color为空则只添加起始和末尾的标记
     */
    public show(startMeasureIndex: number, endMeasureIndex: number, color?: string): void {
        this.startMeasureIndex = startMeasureIndex;
        this.endMeasureIndex = endMeasureIndex;
        this.hidden = false;
        for (const measureBackgroundElement of this.measureBackgroundElements) {
            measureBackgroundElement.style.display = "";
        }
        // tslint:disable-next-line:triple-equals
        if (this.startMeasureIndex >= 0 && this.endMeasureIndex >= 0) {
            this.update(startMeasureIndex, endMeasureIndex, color);
        }

    }
    private drawerMeasureBackground(measureIndex: number, color: string): void {

        // tslint:disable-next-line:typedef
        const currentMeasure: VexFlowMeasure = this.graphic.MeasureList[measureIndex].last() as VexFlowMeasure;
        const musicSystem: VexFlowMusicSystem = currentMeasure.ParentMusicSystem as VexFlowMusicSystem;
        const stave: Vex.Flow.Stave = currentMeasure.getVFStave();
        if (stave) {
            this.measureBackgroundElementId = "measureBackgroundImg-" + measureIndex;
            // find unique measureBackground id in document
            const measureImg: HTMLElement = document.createElement("img");
            measureImg.id = this.measureBackgroundElementId;
            measureImg.style.position = "absolute";
            measureImg.style.zIndex = "-2";
            measureImg.className = "measureBackgroundImg";
            this.container.appendChild(measureImg);
            // tslint:disable-next-line:typedef
            const measureBackgroundElement: HTMLImageElement  = <HTMLImageElement>measureImg;

            measureBackgroundElement.style.left = (stave.getX()  * this.openSheetMusicDisplay.zoom) + "px";
            measureBackgroundElement.width = (stave.getWidth() * this.openSheetMusicDisplay.zoom);

            const bottomStaffline: StaffLine = musicSystem.StaffLines[musicSystem.StaffLines.length - 1];
            // tslint:disable-next-line:typedef
            const y: number = musicSystem.PositionAndShape.AbsolutePosition.y + musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
            const endY: number = musicSystem.PositionAndShape.AbsolutePosition.y +
                bottomStaffline.PositionAndShape.RelativePosition.y + bottomStaffline.StaffHeight;
            measureBackgroundElement.height  = ((endY - y) * 10.0 * this.openSheetMusicDisplay.zoom);
            measureBackgroundElement.style.top = (y * 10.0 * this.openSheetMusicDisplay.zoom) + "px";

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
            this.measureBackgroundElements.push(measureBackgroundElement);
        }


    }
}
