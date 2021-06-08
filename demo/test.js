
import * as jsPDF  from '../node_modules/jspdf-yworks/dist/jspdf.min'
import {VexFlowGraphicalNote} from "../src/MusicalScore/Graphical/VexFlow";
import {OpenSheetMusicDisplayLowVersion} from "../src/OpenSheetMusicDisplay";
var openSheetMusicDisplay = new OpenSheetMusicDisplayLowVersion("osmdCanvas",{
    followCursor: true,
    drawCredits: false,//作者
    drawTitle: false,//标题
    drawSubtitle: true,
    drawComposer: true,

    autoResize: true,
    //backend: "canvas",
    disableCursor: false,

    drawPartNames: true, // try false


    drawFingerings: true,
    fingeringPosition: "left", // left is default. try right. experimental: auto, above, below.
    // fingeringInsideStafflines: "true", // default: false. true draws fingerings directly above/below notes
    setWantedStemDirectionByXml: true, // try false, which was previously the default behavior


    //drawMeasureNumbers: false, // disable drawing measure numbers
    //measureNumberInterval: 4, // draw measure numbers only every 4 bars (and at the beginning of a new system)
    useXMLMeasureNumbers: true, // read measure numbers from xml

    // coloring options
    coloringEnabled: true,
    // defaultColorNotehead: "#CC0055", // try setting a default color. default is black (undefined)
    // defaultColorStem: "#BB0099",

    autoBeam: false, // try true, OSMD Function Test AutoBeam sample
    autoBeamOptions: {
        beam_rests: false,
        beam_middle_rests_only: false,
        //groups: [[3,4], [1,1]],
        maintain_stem_directions: false
    },
});

//init osmd
var config={
    followCursor: true,
    drawCredits: false,//作者
    drawTitle: false,//标题
    drawSubtitle: true,
    drawComposer: true,

    autoResize: true,
    //backend: "canvas",
    disableCursor: false,

    drawPartNames: true, // try false


    drawFingerings: true,
    fingeringPosition: "left", // left is default. try right. experimental: auto, above, below.
    // fingeringInsideStafflines: "true", // default: false. true draws fingerings directly above/below notes
    setWantedStemDirectionByXml: true, // try false, which was previously the default behavior


    //drawMeasureNumbers: false, // disable drawing measure numbers
    //measureNumberInterval: 4, // draw measure numbers only every 4 bars (and at the beginning of a new system)
    useXMLMeasureNumbers: true, // read measure numbers from xml

    // coloring options
    coloringEnabled: true,
    // defaultColorNotehead: "#CC0055", // try setting a default color. default is black (undefined)
    // defaultColorStem: "#BB0099",

    autoBeam: false, // try true, OSMD Function Test AutoBeam sample
    autoBeamOptions: {
        beam_rests: false,
        beam_middle_rests_only: false,
        //groups: [[3,4], [1,1]],
        maintain_stem_directions: false
    },

}

var currentOpenSheetMusicDisplay=openSheetMusicDisplay;
var osmdCanvasHtml;
var repeatOsmdCanvasHtml;

var repeatOsmdCanvasDiv = document.getElementById('repeatOsmdCanvas');
var osmdCanvasDiv = document.getElementById('osmdCanvas');


var cursorTimer;
var fromMeasureNumber, toMeasureNumber;
var threeDatas;
//load musicxml
function loadMusicScore(strXml) {
         if ("" == strXml) return;

          openSheetMusicDisplay.setOptions({ 
              pageBackgroundColor : "#E1E1E188",
             colorStemsLikeNoteheads :true,
              cursorsOptions:[{type: 0, color: '#ffe400', alpha: 0.5, follow: true}]
         });

         openSheetMusicDisplay.load(strXml);
     }


     function callFlutter(data){
      // 使用postMessage toast 是定义好的名称，在接受的时候要拿这个name 去接受
      Toast.postMessage(data); 
  }

  function osmdRender(timeList, left, right){
      openSheetMusicDisplay.render(); 
      
      openSheetMusicDisplay.cursor.reset();
      openSheetMusicDisplay.cursor.show(); 
  } 


  function osmdCursorReset(){
      // openSheetMusicDisplay.Sheet().resetAllNoteStates();
      openSheetMusicDisplay.cursor.reset();
  }
  //refresh osmd
  function osmdOnlyRender(){
      openSheetMusicDisplay.render();
  }



function osmdNotesChangeColor(notes,color){
    notes.forEach(function (item, index){
        openSheetMusicDisplay.UpdateDrawKeyOfMeasure(item.measureIndex,item.horizontalStaffIndex,item.verticalStaffIndex,item.voiceIndex,item.noteIndex,"#ffff00");
    });
}


  function addLog(text){
      var divMsg = document.getElementById('msg');
      divMsg.innerHTML = divMsg.innerHTML + '<br/>' + text;
  }
function drawMeasureBackground(drawFromMeasureNumber,drawUpToMeasureNumber){
    openSheetMusicDisplay.measureBackground.show(drawFromMeasureNumber,drawUpToMeasureNumber,'#F9DCD2');
}

/**
 * Creates a Pdf of the currently rendered MusicXML
 * @param pdfName if no name is given, the composer and title of the piece will be used
 */
function createPdf(pdfName) {
    if (openSheetMusicDisplay.backendType !== BackendType.SVG) {
        console.log("[OSMD] createPdf(): Warning: createPDF is only supported for SVG background for now, not for Canvas." +
            " Please use osmd.setOptions({backendType: SVG}).");
        return;
    }

    if (pdfName === undefined) {
        pdfName = openSheetMusicDisplay.sheet.FullNameString + ".pdf";
    }

    const backends = openSheetMusicDisplay.drawer.Backends;
    let svgElement = backends[0].getSvgElement();

    let pageWidth = 210;
    let pageHeight = 297;
    const engravingRulesPageFormat = openSheetMusicDisplay.rules.PageFormat;
    if (engravingRulesPageFormat && !engravingRulesPageFormat.IsUndefined) {
        pageWidth = engravingRulesPageFormat.width;
        pageHeight = engravingRulesPageFormat.height;
    } else {
        pageHeight = pageWidth * svgElement.clientHeight / svgElement.clientWidth;
    }

    const orientation = pageHeight > pageWidth ? "p" : "l";
    // create a new jsPDF instance
    const pdf = new jsPDF(orientation, "mm", [pageWidth, pageHeight]);
    const scale = pageWidth / svgElement.clientWidth;
    for (let idx = 0, len = backends.length; idx < len; ++idx) {
        if (idx > 0) {
            pdf.addPage();
        }

        svgElement = backends[idx].getSvgElement();

        // render the svg element
        html2canvas(svgElement.parentElement).then(canvas => {
            let oImg = new Image();
            oImg.src = canvas.toDataURL();  // 导出图片
            document.body.appendChild(oImg);  // 将生成的图片添加到body

        });

    }



    // note that using jspdf with svg2pdf creates unnecessary console warnings "AcroForm-Classes are not populated into global-namespace..."
    // this will hopefully be fixed with a new jspdf release, see https://github.com/yWorks/jsPDF/pull/32
}

var loadInput=document.getElementById("load");
var nextInput=document.getElementById("next");
var changeColor=document.getElementById("color");
var changeOption=document.getElementById("changeOption");
var comment=document.getElementById("comment");
var commentArea=document.getElementById("commentArea");
var clearCommentArea=document.getElementById("clearCommentArea");
var createPdfElement=document.getElementById("pdf");
var keyOffset=document.getElementById("keyOffset");
var resetSvg=document.getElementById("resetSvg");
var test=document.getElementById("test");
var redrawMeasure=document.getElementById("redrawMeasure");
var changePracticeContentOsmdChangeButton=document.getElementById("changePracticeContentOsmdChange");
var hideCursor=document.getElementById("hideCursor");
var calculate=document.getElementById("calculate");
var stuck=document.getElementById("stuck");
var isShowCalculate=true;
stuck.onclick=function stuck(){
    openSheetMusicDisplay.addStuckText(0,0,0)
}
calculate.onclick=function(){
    isShowCalculate=!isShowCalculate;
    openSheetMusicDisplay.measureStartIndexs=[1];
    // openSheetMusicDisplay.cursor.updateStyle(isShowCursor?10:0,"#ffe400",1);
    isShowCalculate?openSheetMusicDisplay.addAllClauseComment():openSheetMusicDisplay.removeAllClauseComment();
}

var isShowCursor=true;
hideCursor.onclick=function(){
    isShowCursor=!isShowCursor;
   // openSheetMusicDisplay.cursor.updateStyle(isShowCursor?10:0,"#ffe400",1);
    openSheetMusicDisplay.cursor.updateStyle( 2 * 10.0 * openSheetMusicDisplay.zoom,{color: "#ffe400", alpha: isShowCursor?0.3:0});
    // openSheetMusicDisplay.cursor.updateStyle( 2 * 10.0 * openSheetMusicDisplay.zoom,"#ffe400",isShowCursor?0.3:0);
}
redrawMeasure.onclick=function(){
    openSheetMusicDisplay.redrawMeasure(0,10);
}
commentArea.onclick=function(){

    openSheetMusicDisplay.measureStartIndexs=[1,3,5,6];
    openSheetMusicDisplay.addAllClauseComment();
    // openSheetMusicDisplay.addMeasureComment(1);
    // openSheetMusicDisplay.addMeasureComment(2);
    // openSheetMusicDisplay.addCommentAreaByVoiceEntry(1,0,0,0,1,0,0,0,'第二分句',false);
    // openSheetMusicDisplay.addCommentAreaByVoiceEntry(2,0,0,0,2,0,0,0,'第三分句',false);
  //  openSheetMusicDisplay.addCommentAreaByVoiceEntry(4,0,0,0,6,0,0,0,'错音太多');comment_area_bg.png
  //  openSheetMusicDisplay.addCommentAreaByVoiceEntry(6,0,0,0,8,0,0,0,'错音太多');
  //   openSheetMusicDisplay.addCommentAreaByVoiceEntry(8,0,0,0,10,0,0,0,'错音太多');
  //  openSheetMusicDisplay.addCommentAreaByVoiceEntry(11,0,0,0,15,0,0,0,'错音太多');
  //  openSheetMusicDisplay.addCommentAreaByVoiceEntry(17,0,0,0,18,0,0,0,'错音太多');
}
clearCommentArea.onclick=function(){
    openSheetMusicDisplay.clearCommentArea()
}
changeColor.onclick=function(){
    //修改音符颜色,并重绘
    var notes=[
        {"pianoKey":52,"measureIndex":3,"verticalStaffIndex":0,"horizontalStaffIndex":0,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
        {"pianoKey":40,"measureIndex":3,"verticalStaffIndex":0,"horizontalStaffIndex":1,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
        ]


        notes.forEach(function (item, index){
            openSheetMusicDisplay.changeNoteColor(item.measureIndex,item.horizontalStaffIndex,item.verticalStaffIndex,item.voiceIndex,item.noteIndex,item.noteColor);
    })
}

var isRepeat=false;
changeOption.onclick=function(){
    isRepeat=!isRepeat;
    var changeColorNotes=[
        {"pianoKey":52,"measureIndex":1,"verticalStaffIndex":0,"horizontalStaffIndex":0,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
        {"pianoKey":40,"measureIndex":1,"verticalStaffIndex":0,"horizontalStaffIndex":1,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
    ]
    changePracticeContentOsmdChange(isRepeat,0,10,changeColorNotes,true,true);

}

//更改练习内容时osmd的改变
function changePracticeContentOsmdChange(isRepeat,measureFromIndex, measureToIndex, changeColorNotes,isShowCursor,isDrawMeasureBackgroundAndComment ) {
    try {

        currentOpenSheetMusicDisplay.render();
        //默认时展示光标的
        // changeCursorShow(isShowCursor);
        var changeColorNotes=[
            {"pianoKey":52,"measureIndex":1,"verticalStaffIndex":0,"horizontalStaffIndex":0,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
            {"pianoKey":40,"measureIndex":1,"verticalStaffIndex":0,"horizontalStaffIndex":1,"voiceIndex":0,"noteIndex":0,"noteColor":"'#A9A9A9'","offset":null},
        ]

        // console.log("练习内容修改");
        // openSheetMusicDisplay.isShowClauseComment = isDrawMeasureBackgroundAndComment;
        // //修改琴键颜色
        osmdNotesChangeColor(changeColorNotes);
        // //移除偏移音符
        // removeOffsetStaveNotes();
        // //清除注释
        // clearCommentArea();
        // //清除卡标识
        // openSheetMusicDisplay.removeAllStuckComment();
        // //重绘所有分节
        // openSheetMusicDisplay.redrawAllMeasure();
        //画分节背景图
        // if (isDrawMeasureBackgroundAndComment) {
        //     drawMeasureBackground(measureFromIndex, measureToIndex);
        // } else {
        //     openSheetMusicDisplay.clearAllMeasureBackGround();
        // }
        //光标重置
        // osmdCursorMove(measureFromIndex, 0);
    } catch (ex) {
        console.log(ex);
        SendErrorMessageToFlutter.postMessage(ex.message);
    }



}

comment.onclick=function(){
    openSheetMusicDisplay.AddNoteComment(1,0,0,0,0,"#ff0000");
    //openSheetMusicDisplay.UpdateDrawMeasure(1,0,1,0,0,"#ffff00");

}
nextInput.onclick=function (){
    openSheetMusicDisplay.cursor.moveToPosition(0,1);
}

var xmlString=["1.小夜曲.musicxml","19.musicxml","C大调属七和弦.musicxml","./BrahWiMeSample.musicxml","1.音乐园地.musicxml","蓝色多瑙河.xml","cannonD_all.xml","降B大调音阶.musicxml","1.小前奏曲.xml"]
loadInput.onclick=function (){
         loadMusicScore(xmlString[0],true, true, 1,16)
}
createPdfElement.onclick=function () {
    exportImg().then((value)=>{
            let oImg = new Image();
            oImg.src =value;  // 导出图片
            document.body.appendChild(oImg);
    }
    )


}
async function exportImg() {
    var element =  document.getElementById("osmdCanvas");

    var canvas = await html2canvas(document.body,{
        scale: 0.5,
    });
    var str = canvas.toDataURL();
    return str;
}
keyOffset.onclick=function () {
    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(2,1,1,0,0,10);
    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(2,0,1,0,0,10);

}
resetSvg.onclick=function () {
    openSheetMusicDisplay.removeOffsetStaveNotes();
}


test.onclick=function () {
    openSheetMusicDisplay.test();
}


