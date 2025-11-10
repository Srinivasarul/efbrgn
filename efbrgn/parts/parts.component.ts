import {
  Component,
  ElementRef,
  Inject,
  Optional,
  ViewChild,
} from "@angular/core";
import { Router } from "@angular/router";
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
  DataResult,
  DataStateChangeEventArgs,
  PageEventArgs,
} from "@syncfusion/ej2-grids";
import { NgxSpinnerService } from "ngx-spinner";
import { SnackbarService } from "src/app/helpers/_snackbar/snackbar.service";
import { PartsService } from "src/app/services/pages/parts/parts.service";
import * as $ from "jquery";
import { Xls2jsonService } from "src/app/helpers/xls2json/xls2json";
import { ConfirmationComponent } from "../../common/Confirmation/Confirmation.component";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from "@angular/material/dialog";
import { CustomService } from "../../CustomAdaptor";
import { DataManager, Query, UrlAdaptor } from "@syncfusion/ej2-data";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

@Component({
  selector: "app-parts",
  templateUrl: "./parts.component.html",
  styleUrls: ["./parts.component.scss"],
})
export class PartsComponent {
  @ViewChild("grid", { static: false }) gridInstance!: Grid;
  public isPaginationEnabled: boolean = true;
  public isVirtualScrollEnabled: boolean = false;
  toolbar: any = [];
  roleList: any;
  public gridData: DataManager;
  addPermission: boolean = true;
  public data?: object[];
  private currentPage = 1;
  public commands = [
    {
      buttonOption: {
        content: "Edit",
        cssClass: "e-flat e-primary p-1",
        iconCss: "e-icons e-edit",
      },
    },
  ];
  pageSettings: any;
  gridHeight: number;
  gridInstanceTable: Grid | null = null;
  resizeTimeout: any;
  boundResizeHandler = () => {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.setGridSize();
    }, 200);
  };
  constructor(
    public router: Router,
    private spinnerService: NgxSpinnerService,
    private snackBService: SnackbarService,
    private partsService: PartsService,
    private xls2jsonservice: Xls2jsonService,
    private dialog: MatDialog,
    private service: CustomService,
    private http: HttpClient,
    @Optional() private dialogRef: MatDialogRef<PartsComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public analyticsData?: any
  ) {
    this.data2 = service;
    this.setGridSize();
  }

  public totalRecords: number = 0; // Total number of records
  data1: any = {};
  public data2: Observable<DataStateChangeEventArgs>;
  public state: DataStateChangeEventArgs;
  public editSettings = { allowEditing: true, allowDeleting: true };
  // public pageSettings = { pageSizes: true, pageSize: 10 };
  public payload = {
    partStatus: this.analyticsData?.partStatus,
  };

  ngOnInit() {
    window.addEventListener("resize", this.boundResizeHandler);
    this.data1 = this.partsService.selectedFilters;
    const permission = Common.getLocalStorage("permissionId");
    const sequenceArray: string[] = permission.split(",");
    const addPermission = sequenceArray.includes("18-01");
    if (!addPermission) {
      this.addPermission = false;
    }

    this.state = { skip: 0, take: 10 };
    this.service.execute(
      this.state,
      "workorders/listPartDetailsTable",
      this.payload,
      this.isVirtualScrollEnabled
    );
    this.service.subscribe((data) => {
      this.totalRecords = this.service.totalRecords; // Get total records here
      console.log("Total Records:", this.totalRecords);
    });
  }

  public dataStateChange(state: DataStateChangeEventArgs): void {
    if (
      state.action &&
      (state.action.requestType === "sorting" ||
        state.action.requestType === "filtering")
    ) {
      state.skip = 0; // Reset to first page
      this.gridInstance.goToPage(1);
    }
    let payload = {
      partStatus: this.analyticsData?.partStatus,
    };
    this.service.execute(
      state,
      "workorders/listPartDetailsTable",
      this.payload,
      this.isVirtualScrollEnabled
    );
  }

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  exceldata: any;
  private file: File | null = null;
  jsonData: any[] | null = null;

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

  openTemplate() {
    const filePath = "assets/ExcelTemplates/part_template.xlsx";

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

  changeRoute(route: string) {
    this.router.navigate([route]);
  }

  insertPart(params: any) {
    this.spinnerService.show();
    this.partsService.insertParts(params).subscribe(
      (data: any) => {
        if (data.status == "OK") {
          this.snackBService.successSnackBar(data.message, "");
        }
        if (data.status == "ERROR") {
          this.snackBService.failureSnackBar(data.message, "");
        }
        this.gridInstance.refresh();
        this.spinnerService.hide();
      },
      (error) => {
        this.snackBService.failureSnackBar("Server Connection failed", "");
        this.spinnerService.hide();
      }
    );
  }

  async readExcelFile() {
    try {
      let filteredData = await this.xls2jsonservice.readExcelFile(this.file);
      this.exceldata = filteredData.filter((item) => {
        return !(
          item["Part Name"] === undefined || item["Part Number"] === undefined
        );
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
          this.spinnerService.show();
          let arr = [];
          const promises = this.exceldata.map(async (item: any) => {
            const params = {
              partName: item["Part Name"],
              partNumber: item["Part Number"]
                ? item["Part Number"].toString()
                : "",
              customerId: item["Customer Part ID"]
                ? item["Customer Part ID"].toString()
                : "",
              partIssue: item["Part Issue"],
              drawingNumber: item["Drawing Number"]
                ? item["Drawing Number"].toString()
                : "",
              drawingIssue: item["Drawing Issue"],
              nominalCode: item["Nominal Code"],
              HSNSACCode: item["HSN / SAC code"],
              description: item["Description"],
              unitPrice: item["Unit Price"],
              criticalNotes: item["Critical Notes"],
              orderType: item["Order Type"],
              area: item["Area"],
              areaUOM: item["Area UoM"],
              customerName: item["Customer Name"],
              referenceDocumentInternal: item["Reference Document Internal"],
              thicknessSpecification: item["Thickness Specification"],
            };
            arr.push(params);
          });
          this.insertPartsExcel(arr);
          var response = await Promise.all(promises);
          this.spinnerService.hide();
          setTimeout(() => {
            this.snackBService.successSnackBar("Uploaded Successfully", "");
            this.gridInstance.refresh();
          }, 5000);
          this.fileInput.nativeElement.value = "";
        } else {
          this.fileInput.nativeElement.value = "";
        }
      });
    } else {
      this.snackBService.failureSnackBar("No valid records", "");
    }
  }

  insertPartsExcel(params: any) {
    this.spinnerService.show();
    this.partsService.insertPartsBulk(params).subscribe(
      (data: any) => {
        const report = data.report;

        // Success message
        if (report.inserted > 0) {
          this.snackBService.successSnackBar(
            `${report.inserted} records inserted successfully.`,
            ""
          );
        }

        // Failed items
        if (report.failed > 0) {
          const failedList = report.failedItems
            .map((item: any) => `${item.partNumber}: ${item.reason}`)
            .join("\n");

          this.snackBService.failureSnackBar(
            `${report.failed} records failed. Downloading report...`,
            ""
          );

          // Trigger text file download
          const blob = new Blob([failedList], { type: "text/plain" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "Failed_Parts_Report.txt";
          a.click();
          window.URL.revokeObjectURL(url);
        }

        // No valid items
        if (report.inserted === 0 && report.failed === 0) {
          this.snackBService.failureSnackBar("No valid items to insert.", "");
        }

        this.gridInstance.refresh();
        this.spinnerService.hide();
      },
      (error) => {
        this.snackBService.failureSnackBar("Server connection failed", "");
        this.spinnerService.hide();
      }
    );
  }

  onCustomButtonClick(data: any) {
    var action = data.commandColumn.buttonOption.content;
    var partId = data.rowData.id;

    const permission = Common.getLocalStorage("permissionId");
    const sequenceArray: string[] = permission.split(",");
    const editPermission = sequenceArray.includes("18-03");
    const deletePermission = sequenceArray.includes("18-04");

    if (action == "Edit") {
      if (!editPermission) {
        this.gridInstance.refresh();
        this.snackBService.failureSnackBar("Access denied", "");
        return;
      }

      Common.setLocalStorage("routeTo", "/ailab/parts/details");
      this.router.navigate(["/ailab/parts/details"], {
        queryParams: { recordId: partId, module: "Parts" },
      });
    } else if (action == "Delete") {
      if (!deletePermission) {
        this.gridInstance.refresh();
        this.snackBService.failureSnackBar("Access denied", "");
        return;
      }

      const dialogRef = this.dialog.open(ConfirmationComponent, {
        data: "Are you sure you want to delete?",
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result == "YES") {
          this.deletePart(data.rowData.id);
        }
      });
    }
  }

  deletePart(id: any) {
    this.spinnerService.show();
    let data = { id: id };
    this.partsService.deleteParts(data).subscribe(
      (data: any) => {
        if (data.statuscode == "200") {
          this.snackBService.successSnackBar(data.message, "");
          this.gridInstance.refresh();
        } else {
          this.snackBService.failureSnackBar(data.message, "");
        }
        this.spinnerService.hide();
      },
      (error) => {
        this.snackBService.failureSnackBar("Server Connection failed", "");
        this.spinnerService.hide();
      }
    );
  }

  setGridSize() {
    const screenHeight = window.innerHeight;
    const headerOffset = 200; // estimate space for header, filters, etc.

    this.gridHeight = screenHeight - headerOffset - 190;
    // Assume each row is ~40px high (adjust if needed)
    const defaultSize = Math.floor(this.gridHeight / 36);
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

  ngOnDestroy() {
    this.partsService.selectedFilters = {};
    window.removeEventListener("resize", this.boundResizeHandler);
  }
}
