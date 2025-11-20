using Microsoft.AspNetCore.Mvc;
using AdjustLog.Api.Services;
using AdjustLog.Api.Models;

namespace AdjustLog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly ILASParser _lasParser;
    private readonly IExcelParser _excelParser;
    private readonly IWebHostEnvironment _env;

    public UploadController(ILASParser lasParser, IExcelParser excelParser, IWebHostEnvironment env)
    {
        _lasParser = lasParser;
        _excelParser = excelParser;
        _env = env;
    }

    [HttpPost("las")]
    public async Task<IActionResult> UploadLAS(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var parsedData = _lasParser.Parse(filePath);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(parsedData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("excel")]
    public async Task<IActionResult> UploadExcel(IFormFile file, [FromQuery] string? sheetName = null)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var (intervals, metadata) = string.IsNullOrEmpty(sheetName) 
                ? _excelParser.Parse(filePath)
                : _excelParser.Parse(filePath, sheetName);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(new { intervals, metadata });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("excel/sheets")]
    public async Task<IActionResult> GetExcelSheets(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var sheetNames = _excelParser.GetSheetNames(filePath);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(new { sheets = sheetNames });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("excel/preview")]
    public async Task<IActionResult> GetExcelPreview(IFormFile file, [FromQuery] string sheetName, [FromQuery] int maxRows = 50)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        if (string.IsNullOrEmpty(sheetName))
        {
            return BadRequest(new { error = "Sheet name is required" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var previewData = _excelParser.GetPreviewData(filePath, sheetName, maxRows);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(new { preview = previewData });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("excel/raw-data")]
    public async Task<IActionResult> GetExcelRawData(IFormFile file, [FromQuery] string sheetName, [FromQuery] int maxRows = 50)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        if (string.IsNullOrEmpty(sheetName))
        {
            return BadRequest(new { error = "Sheet name is required" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var rawData = _excelParser.GetRawData(filePath, sheetName, maxRows);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(rawData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("excel/parse-with-mapping")]
    public async Task<IActionResult> ParseExcelWithMapping(IFormFile file, [FromQuery] string sheetName, [FromForm] string mapping)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        if (string.IsNullOrEmpty(sheetName))
        {
            return BadRequest(new { error = "Sheet name is required" });
        }

        if (string.IsNullOrEmpty(mapping))
        {
            return BadRequest(new { error = "Column mapping is required" });
        }

        ColumnMapping? columnMapping;
        try
        {
            columnMapping = System.Text.Json.JsonSerializer.Deserialize<ColumnMapping>(mapping);
        }
        catch
        {
            return BadRequest(new { error = "Invalid column mapping format" });
        }

        if (columnMapping == null)
        {
            return BadRequest(new { error = "Column mapping is required" });
        }

        // Validate required fields
        if (columnMapping.From <= 0 || columnMapping.To <= 0)
        {
            return BadRequest(new { error = "From and To columns are required" });
        }

        try
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var filePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}_{file.FileName}");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var (intervals, metadata) = _excelParser.ParseWithMapping(filePath, sheetName, columnMapping);

            // Clean up
            System.IO.File.Delete(filePath);

            return Ok(new { intervals, metadata });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("combine")]
    public IActionResult CombineData([FromBody] CombineRequest request)
    {
        if (request.LasData == null || request.ExcelData == null)
        {
            return BadRequest(new { error = "Missing lasData or excelData" });
        }

        try
        {
            var projectData = new ProjectData
            {
                WellId = request.ExcelData.Metadata?.WellId ?? request.LasData.Metadata?.WellId ?? "UNKNOWN",
                Metadata = new WellMetadata
                {
                    WellId = request.ExcelData.Metadata?.WellId ?? request.LasData.Metadata?.WellId ?? "UNKNOWN",
                    Easting = request.ExcelData.Metadata?.Easting,
                    Northing = request.ExcelData.Metadata?.Northing,
                    Elevation = request.ExcelData.Metadata?.Elevation,
                    Azimuth = request.ExcelData.Metadata?.Azimuth,
                    DipDegree = request.ExcelData.Metadata?.DipDegree,
                    Depth = request.ExcelData.Metadata?.Depth,
                    GeophysicalDepth = request.ExcelData.Metadata?.GeophysicalDepth,
                    XSectionLine = request.ExcelData.Metadata?.XSectionLine,
                    Year = request.ExcelData.Metadata?.Year,
                    Geologist = request.ExcelData.Metadata?.Geologist,
                },
                GeophysicalLogs = request.LasData.Data ?? new List<GeophysicalLog>(),
                LithologyIntervals = request.ExcelData.Intervals ?? new List<LithologyInterval>(),
                Adjustments = new List<AdjustmentHistory>(),
                Version = "1.0.0",
                LastModified = DateTime.UtcNow.ToString("O")
            };

            return Ok(projectData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

public class CombineRequest
{
    public ParsedLASData? LasData { get; set; }
    public ExcelParsedData? ExcelData { get; set; }
}

public class ExcelParsedData
{
    public List<LithologyInterval>? Intervals { get; set; }
    public WellMetadata? Metadata { get; set; }
}

