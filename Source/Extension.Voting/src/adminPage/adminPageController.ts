﻿import { Voting } from "../entities/voting";
import { AdminPageService } from "./adminPageService";
import { LogExtension } from "../shared/logExtension";
import { bsNotify, escapeText } from "../shared/common";
import * as controls from "VSS/Controls";
import * as dialogs from "VSS/Controls/Dialogs";
import * as menus from "VSS/Controls/Menus";
import * as navigation from "VSS/Controls/Navigation";
import * as statusIndicators from "VSS/Controls/StatusIndicator";
import Vue from "vue";
import Component from "vue-class-component";
import moment from "moment";

@Component
export class AdminPageController extends Vue {
    
    public adminPageService: AdminPageService = new AdminPageService();
    public actualVoting: Voting = new Voting();
    public levels: string[] = [];
    public userIsAdmin: boolean = true;
    public showContent: boolean = false;

    private waitControl: statusIndicators.WaitControl;
    private menuBar: menus.MenuBar;

    public get startDate(): string {
        return moment(this.actualVoting && this.actualVoting.start ? this.actualVoting.start : Date.now()).format("YYYY-MM-DD");
    }

    public set startDate(value: string) {
        this.actualVoting.start = moment(`${value} ${this.startTime}`, "YYYY-MM-DD HH:mm").valueOf();
    }
    
    public get startTime(): string {
        return moment(this.actualVoting && this.actualVoting.start ? this.actualVoting.start : Date.now()).format("HH:mm");
    }

    public set startTime(value: string) {
        this.actualVoting.start = moment(`${this.startDate} ${value}`, "YYYY-MM-DD HH:mm").valueOf();
    }

    public get endDate(): string {
        return moment(this.actualVoting && this.actualVoting.end ? this.actualVoting.end : Date.now()).format("YYYY-MM-DD");
    }

    public set endDate(value: string) {
        this.actualVoting.end = moment(`${value} ${this.endTime}`, "YYYY-MM-DD HH:mm").valueOf();
    }

    public get endTime(): string {
        return moment(this.actualVoting && this.actualVoting.end ? this.actualVoting.end : Date.now()).format("HH:mm");
    }

    public set endTime(value: string) {
        this.actualVoting.end = moment(`${this.endDate} ${value}`, "YYYY-MM-DD HH:mm").valueOf();
    }

    public created() {
        document.getElementById("adminPage").classList.remove("hide");
    }

    public mounted() {
        this.adminPageService = new AdminPageService();

        this.waitControl = controls.create(statusIndicators.WaitControl, $('#waitContainer'), {
            message: "Loading..."
        });

        this.initializeAdminpageAsync();
    }

    public async addToIncludes(ev) {
        ev.preventDefault();

        const text = ev.dataTransfer.getData("text");
        await this.addToIncludeAsync(text);
    }

    public async addToExcludes(ev) {
        ev.preventDefault();

        const text = ev.dataTransfer.getData("text");
        await this.addToExcludeAsync(text);
    }

    public startDrag(ev) {
        ev.dataTransfer.setData("text", ev.target.innerText.trim())
    }

    public onDragOver(ev) {
        ev.preventDefault();
    }

    public validateInput() {
        this.actualVoting.voteLimit = Math.max(1, this.actualVoting.voteLimit);
        this.actualVoting.numberOfVotes = Math.max(1, this.actualVoting.numberOfVotes);
    }

    public isMultipleVotingEnabledChanged() {
        if (!this.actualVoting.isMultipleVotingEnabled) {
            this.actualVoting.voteLimit = 1;
        }
    }

    private async createNewVotingAsync() {
        this.actualVoting = new Voting();

        if (this.levels.length > 0) {
            this.actualVoting.level = this.levels[0];
        }

        this.actualVoting.created = Math.round((new Date()).getTime() / 1000);

        this.showContent = true;
        this.createMenueBar(true);
    }

    private showInfo() {
        dialogs.show(dialogs.ModalDialog, {
            title: "Help",
            contentText: "During a voting you can edit all properties. But please be aware that when changing the voting level or the number of votes per item all votes are reset.",
            buttons: []
        });
    }

    private async initializeAdminpageAsync(): Promise<void> {
        this.waitControl.startWait();

        try {
            await this.adminPageService.loadAsync();
            await this.adminPageService.loadWITFieldNamesAsync();

            this.generateTeamPivot();

            await this.initAsync();
        } finally {
            this.waitControl.endWait();
        }
    }

    private async initAsync() {
        this.waitControl.startWait();

        try {
            this.actualVoting = await this.adminPageService.loadVotingAsync();
            this.buildAdminpage();
        } finally {
            this.waitControl.endWait();
        }
    }

    private generateLevelDropDown() {
        const fieldNames = this.adminPageService.witFieldNames;
        if (fieldNames != null) {
            this.levels = fieldNames;
        }
    }

    private buildAdminpage() {
        this.generateLevelDropDown();

        if (this.actualVoting.isVotingEnabled) {
            LogExtension.log("actual voting enabled");

            this.showContent = true;
            this.createMenueBar(true);
        } else {
            LogExtension.log("actual voting disabled");

            this.showContent = false;
            this.createMenueBar(false);
        }
    }

    private async saveSettingsAsync(isEnabled: boolean, isPaused: boolean | null = null) {
        const voting = this.actualVoting;

        voting.title = escapeText(voting.title);
        if ((voting.title == null || voting.title === "") && isEnabled) {
            bsNotify("danger", "Please provide a title for the voting.");
            return;
        }

        if (!voting.useStartTime && !voting.useEndTime) {
            //ignore!
        } else if (voting.useEndTime && voting.end < Date.now()) {
            bsNotify("danger", "Invalid time period. Please make sure that End is in the future!");
            return;
        } else if (voting.start >= voting.end) {
            bsNotify("danger", "Invalid time period. Please make sure that End is later than Start!");
            return;
        }

        voting.lastModified = Math.round((new Date()).getTime() / 1000);
        voting.description = escapeText(voting.description);
        voting.team = this.adminPageService.team.id;

        voting.isVotingEnabled = isEnabled;

        if (isPaused != null) {
            voting.isVotingPaused = isPaused;
        }

        LogExtension.log("Level:", voting.level);

        await this.adminPageService.saveVotingAsync(voting);

        await this.initAsync();
    }

    private async addToExcludeAsync(item: string) {
        await this.adminPageService.addToExcludeAsync(item);
        this.levels = this.adminPageService.witFieldNames;

        if (this.actualVoting.level === item && this.levels.length > 0) {
            this.actualVoting.level = this.levels[0];
        }
    }

    private async addToIncludeAsync(item: string) {
        await this.adminPageService.addToIncludeAsync(item);
        this.levels = this.adminPageService.witFieldNames;

        if (this.actualVoting.level == null && this.levels.length > 0) {
            this.actualVoting.level = this.levels[0];
        }
    }

    private getMenuItems(isActive: boolean): IContributedMenuItem[] {
        if (this.actualVoting == null || !this.actualVoting.isVotingEnabled) {
            if (!isActive) {
                return [
                    { id: "createNewVoting", text: "Create new voting", icon: "icon icon-add", disabled: !this.userIsAdmin },
                    { separator: true },
                    { id: "excludeList", title: "Exclude work item types", icon: "icon icon-settings", disabled: !this.userIsAdmin }
                ];
            }
        }

        const items = [
            <any>{ id: "saveSettings", text: "Save", title: "Save voting", icon: "icon icon-save", disabled: !this.userIsAdmin }
        ];

        if (this.actualVoting.isVotingPaused) {
            items.push({ id: "resumeVoting", title: "Resume voting", icon: "icon icon-play", disabled: !this.userIsAdmin });
        } else {
            items.push({ id: "pauseVoting", title: "Pause voting", icon: "icon icon-pause", disabled: !this.userIsAdmin });
        }

        items.push({ id: "terminateVoting", title: "Stop voting", icon: "icon icon-delete", disabled: !this.userIsAdmin });
        items.push({ separator: true });
        items.push({ id: "infoButton", title: "Help", icon: "icon icon-info", disabled: false });
        items.push({ id: "excludeList", title: "Exclude work item types", icon: "icon icon-settings", disabled: !this.userIsAdmin });

        return items;
    }

    private createMenueBar(isActive: boolean) {
        if (this.menuBar == null) {
            this.menuBar = controls.create(menus.MenuBar, $("#menueBar-container"), {
                showIcon: true,
                executeAction: (args) => {
                    var command = args.get_commandName();
                    this.executeMenuAction(command);
                }
            });
        
            document.getElementById("menueBar-container").classList.remove("hide");
        }

        this.menuBar.updateItems(this.getMenuItems(isActive));
    }

    private executeMenuAction(command: string) {
        switch (command) {
            case "createNewVoting":
                this.createNewVotingAsync();
                break;
            case "saveSettings":
                this.saveSettingsAsync(true);
                break;
            case "pauseVoting":
                this.saveSettingsAsync(true, true);
                break;
            case "resumeVoting":
                this.saveSettingsAsync(true, false);
                break;
            case "infoButton":
                this.showInfo();
                break;
            case "terminateVoting":
                this.saveSettingsAsync(false);
                break;
            case "excludeList":
                $('#excludeModal').modal();
                break;
        }
    }

    private generateTeamPivot() {
        controls.create(navigation.PivotFilter, $(".filter-container"), {
            behavior: "dropdown",
            text: "Team",
            items: this.adminPageService.teams.map(team => {
                return {
                    id: team.id,
                    text: team.name,
                    value: team.id,
                    selected: this.adminPageService.team.id === team.id
                };
            }).sort((a, b) => a.text.localeCompare(b.text)),
            change: (item) => {
                this.adminPageService.team = item;
                this.initAsync();
            }
        });
    }
}