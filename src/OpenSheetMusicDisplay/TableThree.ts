

export class TableThree {
    //小节，索引从1开始
    public measureIndex: number;
    //垂直index，索引从0开始
    public groupIndex: number;
    //水平第几组，索引从0开始
    public staffIndex: number;
    //第几个voice
    public voiceIndex: number;
    //第几个音符，索引从0开始，从下向上排序
    public noteIndex: number;
    //开始时间
    public startTime: number;

    //结束时间
    public endTime: number;
    //键值
    public pianoKey: number;

    constructor(measureIndex: number, groupIndex: number, staffIndex: number, voiceIndex: number, noteIndex: number, ) {
        this.measureIndex = measureIndex;
        this.groupIndex = groupIndex;
        this.staffIndex = staffIndex;
        this.voiceIndex = voiceIndex;
        this.noteIndex = noteIndex;
    }

}
