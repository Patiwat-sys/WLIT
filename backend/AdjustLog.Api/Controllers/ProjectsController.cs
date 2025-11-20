using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using AdjustLog.Api.Models;

namespace AdjustLog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public ProjectsController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string GetProjectsDirectory()
    {
        var projectsDir = Path.Combine(_env.ContentRootPath, "Projects");
        if (!Directory.Exists(projectsDir))
        {
            Directory.CreateDirectory(projectsDir);
        }
        return projectsDir;
    }

    [HttpPost("save")]
    public IActionResult SaveProject([FromBody] ProjectData projectData)
    {
        if (string.IsNullOrEmpty(projectData.WellId))
        {
            return BadRequest(new { error = "wellId is required" });
        }

        try
        {
            projectData.LastModified = DateTime.UtcNow.ToString("O");
            var filename = $"{projectData.WellId}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.json";
            var filepath = Path.Combine(GetProjectsDirectory(), filename);

            var options = new JsonSerializerOptions { WriteIndented = true };
            System.IO.File.WriteAllText(filepath, JsonSerializer.Serialize(projectData, options));

            return Ok(new
            {
                success = true,
                projectId = filename,
                message = "Project saved successfully"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{projectId}")]
    public IActionResult LoadProject(string projectId)
    {
        try
        {
            var filepath = Path.Combine(GetProjectsDirectory(), projectId);

            if (!System.IO.File.Exists(filepath))
            {
                return NotFound(new { error = "Project not found" });
            }

            var fileContent = System.IO.File.ReadAllText(filepath);
            var projectData = JsonSerializer.Deserialize<ProjectData>(fileContent);

            return Ok(projectData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet]
    public IActionResult ListProjects()
    {
        try
        {
            var projectsDir = GetProjectsDirectory();
            var files = Directory.GetFiles(projectsDir, "*.json")
                .Select(file =>
                {
                    var fileInfo = new FileInfo(file);
                    var content = System.IO.File.ReadAllText(file);
                    var project = JsonSerializer.Deserialize<ProjectData>(content);

                    return new
                    {
                        projectId = fileInfo.Name,
                        wellId = project?.WellId ?? "",
                        lastModified = project?.LastModified ?? ""
                    };
                })
                .OrderByDescending(p => p.lastModified)
                .ToList();

            return Ok(files);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("{projectId}")]
    public IActionResult DeleteProject(string projectId)
    {
        try
        {
            var filepath = Path.Combine(GetProjectsDirectory(), projectId);

            if (!System.IO.File.Exists(filepath))
            {
                return NotFound(new { error = "Project not found" });
            }

            System.IO.File.Delete(filepath);

            return Ok(new { success = true, message = "Project deleted successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

