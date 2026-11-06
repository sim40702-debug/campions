// Interfaccia di guida: velocita', marcia, giri, piega, impennata, meteo e messaggi.
// Disegnata con il Canvas di Unreal (piu' avanti si passa a UMG con un menu vero).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "MRWHud.generated.h"

UCLASS()
class MOTORACINGWORLD_API AMRWHud : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
};
