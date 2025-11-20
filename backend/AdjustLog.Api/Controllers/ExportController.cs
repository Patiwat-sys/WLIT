using Microsoft.AspNetCore.Mvc;
using OfficeOpenXml;
using AdjustLog.Api.Models;
using System.Text;

namespace AdjustLog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExportController : ControllerBase
{
    [HttpPost("excel")]
    public IActionResult ExportToExcel([FromBody] ProjectData projectData)
    {
        if (projectData.LithologyIntervals == null || projectData.LithologyIntervals.Count == 0)
        {
            return BadRequest(new { error = "No lithology intervals to export" });
        }

        try
        {
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("Lithology Log");

            // Headers
            worksheet.Cells[1, 1].Value = "DHID";
            worksheet.Cells[1, 2].Value = "From";
            worksheet.Cells[1, 3].Value = "To";
            worksheet.Cells[1, 4].Value = "Thickness";
            worksheet.Cells[1, 5].Value = "Lithology";
            worksheet.Cells[1, 6].Value = "Rock Code";
            worksheet.Cells[1, 7].Value = "Splited Seam";
            worksheet.Cells[1, 8].Value = "Splited Code";

            // Data
            for (int i = 0; i < projectData.LithologyIntervals.Count; i++)
            {
                var interval = projectData.LithologyIntervals[i];
                var row = i + 2;

                worksheet.Cells[row, 1].Value = projectData.WellId;
                worksheet.Cells[row, 2].Value = interval.AdjustedTop ?? interval.Top;
                worksheet.Cells[row, 3].Value = interval.AdjustedBottom ?? interval.Bottom;
                worksheet.Cells[row, 4].Value = (interval.AdjustedBottom ?? interval.Bottom) - 
                                               (interval.AdjustedTop ?? interval.Top);
                worksheet.Cells[row, 5].Value = interval.LithologyType;
                worksheet.Cells[row, 6].Value = interval.RockCode;
                worksheet.Cells[row, 7].Value = interval.SplitedSeam;
                worksheet.Cells[row, 8].Value = interval.SplitedCode;
            }

            var stream = new MemoryStream();
            package.SaveAs(stream);
            stream.Position = 0;

            return File(stream.ToArray(), 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{projectData.WellId}_adjusted.xlsx");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("csv")]
    public IActionResult ExportToCSV([FromBody] ProjectData projectData)
    {
        if (projectData.LithologyIntervals == null || projectData.LithologyIntervals.Count == 0)
        {
            return BadRequest(new { error = "No lithology intervals to export" });
        }

        try
        {
            var csv = new StringBuilder();
            csv.AppendLine("DHID,From,To,Thickness,Lithology,Rock Code,Splited Seam,Splited Code");

            foreach (var interval in projectData.LithologyIntervals)
            {
                var from = interval.AdjustedTop ?? interval.Top;
                var to = interval.AdjustedBottom ?? interval.Bottom;
                var thickness = to - from;

                csv.AppendLine($"{projectData.WellId},{from},{to},{thickness}," +
                              $"{interval.LithologyType},{interval.RockCode}," +
                              $"{interval.SplitedSeam ?? ""},{interval.SplitedCode}");
            }

            var bytes = Encoding.UTF8.GetBytes(csv.ToString());
            return File(bytes, "text/csv", $"{projectData.WellId}_adjusted.csv");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

