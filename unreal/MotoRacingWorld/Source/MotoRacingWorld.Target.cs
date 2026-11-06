// Gioco (Windows e Mac)
using UnrealBuildTool;

public class MotoRacingWorldTarget : TargetRules
{
	public MotoRacingWorldTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("MotoRacingWorld");
	}
}
