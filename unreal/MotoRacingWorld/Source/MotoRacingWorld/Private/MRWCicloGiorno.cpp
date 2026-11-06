#include "MRWCicloGiorno.h"

#include "Components/ExponentialHeightFogComponent.h"
#include "Components/LightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Materials/MaterialParameterCollection.h"

AMRWCicloGiorno::AMRWCicloGiorno()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AMRWCicloGiorno::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	Aggiorna(0.0f);
}

void AMRWCicloGiorno::BeginPlay()
{
	Super::BeginPlay();
	if (NebbiaAttore && NebbiaAttore->GetComponent())
	{
		DensitaNebbiaIniziale = NebbiaAttore->GetComponent()->FogDensity;
	}
	Aggiorna(0.0f);
}

void AMRWCicloGiorno::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Aggiorna(DeltaSeconds);
}

void AMRWCicloGiorno::Aggiorna(float DeltaSeconds)
{
	// 1) Il tempo passa
	OraDelGiorno = FMath::Fmod(OraDelGiorno + DeltaSeconds * MinutiPerSecondo / 60.0f, 24.0f);

	// 2) Posizione del sole: sorge alle 6, mezzogiorno alle 12, tramonta alle 18 (semplificato)
	const float Angolo = (OraDelGiorno - 6.0f) / 12.0f * PI;           // 0 all'alba, PI al tramonto
	const float Altezza = FMath::Sin(Angolo) * AltezzaMassimaSole;       // gradi sopra l'orizzonte
	const float Direzione = 90.0f + (OraDelGiorno - 6.0f) / 12.0f * 180.0f; // da est a ovest

	// 0 = giorno pieno, 1 = notte fonda (con alba e tramonto morbidi)
	Notte = FMath::Clamp(1.0f - (Altezza + 6.0f) / 12.0f, 0.0f, 1.0f);

	if (SoleLuce)
	{
		SoleLuce->SetActorRotation(FRotator(-Altezza, Direzione, 0.0f));
		if (ULightComponent* Luce = SoleLuce->GetLightComponent())
		{
			// Luce calda all'alba e al tramonto, bianca a mezzogiorno
			const float Bassezza = 1.0f - FMath::Clamp(Altezza / 30.0f, 0.0f, 1.0f);
			Luce->SetTemperature(FMath::Lerp(6200.0f, 3200.0f, Bassezza));
			// Con la pioggia le nuvole coprono il sole
			const float Copertura = 1.0f - 0.8f * Pioggia;
			Luce->SetIntensity(LuceSoleMezzogiorno * (1.0f - Notte) * Copertura);
		}
	}

	// 3) Nebbia: piu' fitta con la nebbia del meteo e con la pioggia
	if (NebbiaAttore && NebbiaAttore->GetComponent())
	{
		const float Fattore = 1.0f + Nebbia * 12.0f + Pioggia * 3.0f;
		NebbiaAttore->GetComponent()->SetFogDensity(DensitaNebbiaIniziale * Fattore);
	}

	// 4) Strade bagnate: si bagnano in fretta quando piove, si asciugano piano
	if (Pioggia > Bagnato)
	{
		Bagnato = FMath::Min(Pioggia, Bagnato + DeltaSeconds * 0.2f);
	}
	else
	{
		Bagnato = FMath::Max(Pioggia, Bagnato - DeltaSeconds * VelocitaAsciugatura);
	}

	// 5) Valori per i materiali (asfalto bagnato, lampioni accesi di notte, finestre illuminate)
	if (ParametriMeteo)
	{
		UKismetMaterialLibrary::SetScalarParameterValue(this, ParametriMeteo, TEXT("Notte"), Notte);
		UKismetMaterialLibrary::SetScalarParameterValue(this, ParametriMeteo, TEXT("Pioggia"), Pioggia);
		UKismetMaterialLibrary::SetScalarParameterValue(this, ParametriMeteo, TEXT("Bagnato"), Bagnato);
	}
}
