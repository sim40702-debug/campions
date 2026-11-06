// Regole del gioco: quale moto usa il giocatore, quale interfaccia,
// e la prima volta sceglie il preset grafico adatto al computer (benchmark di Unreal).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MRWGameMode.generated.h"

UCLASS()
class MOTORACINGWORLD_API AMRWGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AMRWGameMode();

	virtual void StartPlay() override;
};
