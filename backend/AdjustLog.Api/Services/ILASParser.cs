using AdjustLog.Api.Models;

namespace AdjustLog.Api.Services;

public interface ILASParser
{
    ParsedLASData Parse(string filePath);
}

