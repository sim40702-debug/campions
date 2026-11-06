#include "MRWGameMode.h"

#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/GameUserSettings.h"
#include "MRWHud.h"
#include "MRWMoto.h"
#include "MRWTerreno.h"

AMRWGameMode::AMRWGameMode()
{
	DefaultPawnClass = AMRWMoto::StaticClass();
	HUDClass = AMRWHud::StaticClass();
}

void AMRWGameMode::StartPlay()
{
	// Se nel livello non c'e' il terreno del Ticino lo aggiungo (senza materiali speciali)
	bool bCeTerreno = false;
	for (TActorIterator<AMRWTerreno> It(GetWorld()); It; ++It)
	{
		bCeTerreno = true;
	}
	if (!bCeTerreno)
	{
		GetWorld()->SpawnActor<AMRWTerreno>(AMRWTerreno::StaticClass(), FTransform::Identity);
	}

	// Prima partita su questo computer: Unreal misura CPU e scheda video e sceglie il preset
	UGameUserSettings* Impostazioni = GEngine ? GEngine->GetGameUserSettings() : nullptr;
	if (Impostazioni != nullptr && Impostazioni->GetLastGPUBenchmarkResult() < 0.0f)
	{
		Impostazioni->RunHardwareBenchmark();
		Impostazioni->ApplyHardwareBenchmarkResults();
		UE_LOG(LogTemp, Log, TEXT("[MRW] Benchmark: preset %d"), Impostazioni->GetOverallScalabilityLevel());
	}

	Super::StartPlay();
}
