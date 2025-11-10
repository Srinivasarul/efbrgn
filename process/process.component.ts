import { Component, ElementRef, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Common } from "src/app/helpers/constants/common";
import {
  CommandClickEventArgs,
  CommandColumn,
  Edit,
  EditSettingsModel,
  Filter,
  Grid,
  Group,
  Page,
  Sort,
  Toolbar,
} from "@syncfusion/ej2-grids";
import { ProcessService } from "src/app/services/pages/process/process/process.service";
import * as $ from "jquery";
import { SnackbarService } from "src/app/helpers/_snackbar/snackbar.service";
import { Xls2jsonService } from "src/app/helpers/xls2json/xls2json";
import { NgxSpinnerService } from "ngx-spinner";
import { ProcessDetailsService } from "src/app/services/pages/process/process-details/process-details.service";
import { CurrencyService } from "src/app/services/pages/system-setup/currency/currency.service";
import { ConfirmationComponent } from "../../common/Confirmation/Confirmation.component";
import { MatDialog } from "@angular/material/dialog";

@Component({
  selector: "app-process",
  templateUrl: "./process.component.html",
  styleUrls: ["./process.component.scss"],
})
export class ProcessComponent {
  data: any = [];
  addPermission: boolean = true;

  constructor(
    public router: Router,
    private processService: ProcessService,
    private currencyService: CurrencyService,
    private snackBService: SnackbarService,
    private processDetailsService: ProcessDetailsService,
    private xls2jsonservice: Xls2jsonService,
    private spinnerService: NgxSpinnerService,
    private dialog: MatDialog,
    private route: ActivatedRoute
  ) { }
  gridHeight: number;
  gridInstance: Grid | null = null;
  procurementType: any = "";
  boundResizeHandler = this.setGridSize.bind(this);
  @ViewChild("processFileInput")
  processFileInput!: ElementRef<HTMLInputElement>;
  exceldata: any;
  private file: File | null = null;
  jsonData: any[] | null = null;
  currencyListArr: any;
  pageSettings: any;
  editSettings!: EditSettingsModel;
  activeStatus: boolean = true;
  showAll: boolean = false;
  ngOnInit(): void {
    window.addEventListener("resize", this.boundResizeHandler);
    const permission = Common.getLocalStorage("permissionId");
    const sequenceArray: string[] = permission.split(",");
    const addPermission = sequenceArray.includes("09-01-01");
    if (!addPermission) {
      this.addPermission = false;
    }

    this.loadDependency();
  }
  page: any = "";
  loadDependency() {
    this.route.queryParams.subscribe((params) => {
      this.page = params["page"];
    });
    if (this.page) {
      this.prepareGridNDT();
    } else {
      this.prepareGrid();
    }
  }

  onFileChange(event: any): void {
    const files = event?.target?.files;

    if (files && files.length > 0) {
      this.file = files[0];
    }
    if (
      this.file["name"]?.split(".")[1] != "xlx" &&
      this.file["name"]?.split(".")[1] != "xlsx"
    ) {
      this.snackBService.failureSnackBar(
        "Kindly Upload the valid excel file",
        ""
      );
      return;
    }
    this.readExcelFile();
  }

  async readExcelFile() {
    try {
      let filteredData = await this.xls2jsonservice.readExcelFile(this.file);
      this.exceldata = filteredData.filter((item) => {
        return !(item["Process Code"] === undefined);
      });
    } catch (error) {
      this.snackBService.failureSnackBar("Err reading the excel", "");
    }
    if (this.exceldata.length > 0) {
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        data: `${this.exceldata.length} records are valid. Are you sure to import..?`,
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result == "YES") {
          const promises = this.exceldata.map(async (item: any) => {
            const params = {
              operationCode: item["Process Code"],
              operationDescription: item["Process Description"],
              operationNotes: item["Process Notes"],
              hourlyChargingRate: item["Hourly Charging Rate"],
              unitsInWatt: item["Units in Watt"],
              setupType: item["Setup Type"],
              hourlyUnit: item["Hourly Unit"],
              cycleTime: item["Cycle Time"],
              costPerKWh: item["Cost Per Kwh"],
              currencyId: "",
            };
            return this.insertProcessData(params);
          });

          var response = await Promise.all(promises);
          this.processFileInput.nativeElement.value = "";
        } else {
          this.processFileInput.nativeElement.value = "";
        }
      });
    } else {
      this.snackBService.failureSnackBar("No valid records", "");
    }
  }

  insertProcessData(params: any) {
    this.spinnerService.show();
    this.processDetailsService.addProcess(params).subscribe(
      (data: any) => {
        if (data.status == "OK") {
          this.prepareGrid();
          this.snackBService.successSnackBar(data.message, "");
        }
        if (data.status == "ERROR") {
          this.snackBService.failureSnackBar(data.message, "");
        }
      },
      (error) => {
        this.snackBService.failureSnackBar("Server Connection failed", "");
        this.spinnerService.hide();
      }
    );
  }

  openTemplate() {
    const filePath = "assets/ExcelTemplates/process_template.xlsx";

    // Open the file in a new window
    const newWindow = window.open(filePath, "_blank");

    // If the file couldn't be opened, show an error
    if (!newWindow) {
      this.snackBService.warningSnackBar(
        "Unable to open the file. Please check your pop-up blocker settings.",
        ""
      );
    }
  }
  public commands = [
    {
      type: "Edit",
      buttonOption: {
        content: "",
        cssClass: "e-flat p-0",
        iconCss: "e-edit e-icons",
      },
    },
  ];

  prepareGrid() {
    this.processService
      .getProcessList({ page: this.page, showAll: this.showAll })
      .subscribe((data) => {
        if (data.status == "OK") {
          this.data = data.data;
          this.setGridSize();
        } else {
        }
      });
  }

  setGridSize() {
    const screenHeight = window.innerHeight;
    const headerOffset = 200; // estimate space for header, filters, etc.

    this.gridHeight = screenHeight - headerOffset - 205;
    // Assume each row is ~40px high (adjust if needed)
    const defaultSize = Math.floor(this.gridHeight / 32);
    this.pageSettings = {
      pageSize: defaultSize,
      pageSizes: [10, 25, 50, 100, 200, "All"],
    };
    if (this.gridInstance) {
      this.gridInstance.pageSettings = this.pageSettings;
      this.gridInstance.height = this.gridHeight;
      this.gridInstance.dataBind();
    }
  }

  onSlideToggleChangeShowAll(event) {
    this.showAll = event.checked;
    this.prepareGrid();
  }

  onSlideToggleChange(event, data) {
    data.activeStatus = event.checked;
    this.processDetailsService.updateProcess(data).subscribe(
      (data: any) => {
        this.snackBService.successSnackBar(data.message, "");
      },
      (error) => {
        this.snackBService.failureSnackBar("Server Connection failed", "");
      }
    );
  }

  prepareGridNDT() {
    $("#Grid").empty();
    Grid.Inject(Group, Filter, Page, Sort, Edit, Toolbar, CommandColumn);
    this.processService
      .listOperationsNDT({ page: this.page })
      .subscribe((data) => {
        if (data.status == "OK") {
          this.data = data.data;
          this.setGridSize();
          let grid: Grid = new Grid({
            dataSource: this.data,
            columns: [
              {
                field: "id",
                headerText: "id",
                width: 120,
                type: "string",
                visible: false,
              },
              {
                field: "operationCode",
                width: 140,
                headerText: "Process Code",
                type: "string",
              },
              {
                field: "operationDescription",
                headerText: "Process Description",

                width: 120,
                format: "string",
              },
              {
                field: "operationNotes",
                headerText: "Process Notes",
                width: 140,
                format: "string",
              },
              {
                field: "hourlyChargingRate",
                headerText: "Hourly Charging Rate",

                width: 120,
                format: "string",
              },
              {
                field: "unitsInWatt",
                headerText: "Units In Watt",
                width: 140,
                format: "string",
              },
              {
                headerText: "Action",
                width: 120,
                commands: [
                  {
                    buttonOption: {
                      content: "Edit",
                      cssClass: "e-flat",
                      iconCss: "e-edit e-icons",
                    },
                  },
                  //  //{
                  //   type: "Delete",
                  //   buttonOption: {
                  //     content: "Delete",
                  //     cssClass: "e-flat",
                  //     iconCss: "e-delete e-icons",
                  //   },
                  // },
                ],
              },
            ],
            commandClick: (args: CommandClickEventArgs) => {
              this.onCustomButtonClick(args);
            },
            editSettings: { allowEditing: true, allowDeleting: true },
            allowFiltering: true,
            allowPaging: true,
            pageSettings: { pageSize: 6 },
            allowSorting: true,
            allowGrouping: true,
            height: 300,
          });
          grid.appendTo("#Grid");
        } else {
        }
      });
  }

  getcurrencylist() {
    try {
      this.currencyService.getCurrencyList({}).subscribe((data) => {
        if (data.statuscode == "200") {
          this.currencyListArr = data.data;
        } else {
          this.snackBService.failureSnackBar(data.message, "");
        }
      });
    } catch (err: any) {
      this.snackBService.failureSnackBar(err.message, "");
    }
  }

  onCustomButtonClick(data: any) {
    var action = data.commandColumn.buttonOption.cssClass;
    var op_id = data.rowData.id;
    const permission = Common.getLocalStorage("permissionId");
    const sequenceArray: string[] = permission.split(",");
    const editPermission = sequenceArray.includes("09-01-03");
    const deletePermission = sequenceArray.includes("09-01-04");

    if (action == "e-flat p-0") {
      if (!editPermission) {
        this.prepareGrid();
        this.snackBService.failureSnackBar("Access denied", "");
        return;
      }
      Common.setLocalStorage("routeTo", "/ailab/process/process-details");
      this.router.navigate(["/ailab/process/process-details"], {
        queryParams: { recordId: op_id, module: "process" },
      });
    } else if (action == "Delete") {
      if (!deletePermission) {
        this.prepareGrid();
        this.snackBService.failureSnackBar("Access denied", "");
        return;
      }

      const dialogRef = this.dialog.open(ConfirmationComponent, {
        data: "Are you sure you want to delete?",
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result == "YES") {
          this.deleteProcess(op_id);
        }
      });
    }
  }

  changeRoute(route: string) {
    this.router.navigate([route]);
  }

  deleteProcess(id) {
    try {
      this.processService.deleteProcess({ id: id }).subscribe((data) => {
        if (data.statuscode == "200") {
          this.snackBService.successSnackBar(data.message, "");
        } else {
          this.snackBService.failureSnackBar(data.message, "");
        }
      });
    } catch (err: any) {
      this.snackBService.failureSnackBar(err.message, "");
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.boundResizeHandler);
  }
}
