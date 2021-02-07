import { OpenSheetMusicDisplay, BackendType } from '../src/OpenSheetMusicDisplay';
import * as jsPDF  from '../node_modules/jspdf-yworks/dist/jspdf.min'
import {VexFlowGraphicalNote} from "../src/MusicalScore/Graphical/VexFlow";
var openSheetMusicDisplay = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmdCanvas",{
   autoResize: true,
   autoBeam: true,
   coloringEnabled: true,
   drawTitle: true, 
   drawSubtitle : true,
   drawComposer:true,
   drawCredits:true,
   followCursor: true,

});
var cursorTimer;
var fromMeasureNumber, toMeasureNumber;
var threeDatas;
        //load musicxml
function loadMusicScore(strXml, left, right, drawFromMeasureNumber, drawUpToMeasureNumber) {
         if ("" == strXml) return;

          openSheetMusicDisplay.setOptions({ 
              pageBackgroundColor : "#E1E1E188",
             colorStemsLikeNoteheads :true,
         });
         
         if (drawFromMeasureNumber && drawUpToMeasureNumber)
         {
             fromMeasureNumber = drawFromMeasureNumber-1;
             toMeasureNumber = drawUpToMeasureNumber-1;
         }
         else{
             addLog('no measure data');
         }
         openSheetMusicDisplay.load(strXml).then(function(){
                 openSheetMusicDisplay.render();
                openSheetMusicDisplay.addClauseComment(0,1)
                openSheetMusicDisplay.cursor.show();
                 onXmlRenderFinished.postMessage("加载完成");
             }).catch(function(ex){
             addLog(ex)
    });
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

  /// Cursor Next
  function osmdCursorNext(measureIndex,voiceIndex){
        openSheetMusicDisplay.cursor.moveToPosition(0,1);


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
//更改练习内容时osmd的改变
function changePracticeContentOsmdChange(measureFromIndex,measureToIndex,changeColorNotes){
    //修改琴键颜色
    //osmdNotesChangeColor(changeColorNotes);
    //清除乐谱svg上所有后期添加的标签
    openSheetMusicDisplay.resetDawMusicSheet(measureFromIndex,measureToIndex);
    //光标重置
    openSheetMusicDisplay.cursor.moveToPosition(measureFromIndex,0);
    //重绘所有分节
    openSheetMusicDisplay.redrawAllMeasure();
    //画分节背景图
    drawMeasureBackground(measureFromIndex,measureToIndex);
    openSheetMusicDisplay.cursor.hide();
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
var backGroundColor=document.getElementById("backGroundColor");
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
    openSheetMusicDisplay.cursor.updateStyle( 2 * 10.0 * openSheetMusicDisplay.zoom,"#ffe400",isShowCursor?0.3:0);
}
redrawMeasure.onclick=function(){
    openSheetMusicDisplay.redrawMeasure(0,10);
}
commentArea.onclick=function(){

   openSheetMusicDisplay.addAllMeasureComment(0,10);
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
        {"pianoKey":52,"measureIndex":0,"verticalStaffIndex":0,"horizontalStaffIndex":0,"voiceIndex":0,"noteIndex":0,"noteColor":"'#ff564b'","offset":null},
        {"pianoKey":40,"measureIndex":0,"verticalStaffIndex":0,"horizontalStaffIndex":1,"voiceIndex":0,"noteIndex":0,"noteColor":"'#ff564b'","offset":null},
        ]


        notes.forEach(function (item, index){
            openSheetMusicDisplay.changeNoteColor(item.measureIndex,item.horizontalStaffIndex,item.verticalStaffIndex,item.voiceIndex,item.noteIndex,item.noteColor);
    })
}

let isShowbackGroundColor=false;
backGroundColor.onclick=function(){
    isShowbackGroundColor=!isShowbackGroundColor;
    isShowbackGroundColor? openSheetMusicDisplay.drawMeasureBackGround(0,3,"#ffeeea"):openSheetMusicDisplay.clearAllMeasureBackGround();
    // openSheetMusicDisplay.drawMeasureBackGround(1,"#ffeeea");
   // measureStartNum++;
  //  openSheetMusicDisplay.redrawMeasure(1,5)

}
comment.onclick=function(){
    openSheetMusicDisplay.AddNoteComment(1,0,0,0,0,"#ff0000");
    //openSheetMusicDisplay.UpdateDrawMeasure(1,0,1,0,0,"#ffff00");

}
nextInput.onclick=function (){
   osmdCursorNext(0);
}

var xmlString=["19.musicxml","C大调属七和弦.musicxml","./BrahWiMeSample.musicxml","1.音乐园地.musicxml","蓝色多瑙河.xml","cannonD_all.xml","降B大调音阶.musicxml","1.小前奏曲.xml"]
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
    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(0,0,1,0,0,10);
    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(1,0,1,0,0,10);

    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(0,0,2,0,0,10);
    openSheetMusicDisplay.OffsetDrawKeyOfMeasure(1,0,2,0,0,10);
}
resetSvg.onclick=function () {
    openSheetMusicDisplay.resetSvg();
}


test.onclick=function () {
    openSheetMusicDisplay.test();
}
changePracticeContentOsmdChangeButton.onclick=function () {
    changePracticeContentOsmdChange(1,3,"")
}


