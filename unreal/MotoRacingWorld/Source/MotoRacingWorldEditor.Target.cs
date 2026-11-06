// Editor (Windows e Mac)
using UnrealBuildTool;

public class MotoRacingWorldEditorTarget : TargetRules
{
	public MotoRacingWorldEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("MotoRacingWorld");
	}
}
