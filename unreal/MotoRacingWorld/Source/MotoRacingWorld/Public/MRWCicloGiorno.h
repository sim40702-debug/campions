// Ciclo giorno/notte e meteo del Ticino.
// Muove il sole secondo l'ora, cambia colore e forza della luce, la nebbia,
// e passa ai materiali i valori "Notte", "Pioggia" e "Bagnato" (Material Parameter Collection).

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MRWCicloGiorno.generated.h"

class ADirectionalLight;
class AExponentialHeightFog;
class UMaterialParameterCollection;

UCLASS()
class MOTORACINGWORLD_API AMRWCicloGiorno : public AActor
{
	GENERATED_BODY()

public:
	AMRWCicloGiorno();

	virtual void Tick(float DeltaSeconds) override;

	// Ora del giorno: 0 = mezzanotte, 12 = mezzogiorno
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ciclo giorno", meta = (ClampMin = "0.0", ClampMax = "24.0"))
	float OraDelGiorno = 10.0f;

	// Minuti di gioco che passano in un secondo reale (0 = tempo fermo)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ciclo giorno", meta = (ClampMin = "0.0"))
	float MinutiPerSecondo = 1.0f;

	// Altezza massima del sole a mezzogiorno (gradi). Ticino d'estate circa 66, d'inverno circa 21.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ciclo giorno", meta = (ClampMin = "5.0", ClampMax = "90.0"))
	float AltezzaMassimaSole = 55.0f;

	// Intensita' del sole a mezzogiorno (lux, come nel modello fisico di Unreal)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ciclo giorno")
	float LuceSoleMezzogiorno = 10.0f;

	// Pioggia: 0 = asciutto, 1 = temporale
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Meteo", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Pioggia = 0.0f;

	// Nebbia in piu' (0 = limpido, 1 = nebbia fitta)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Meteo", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Nebbia = 0.0f;

	// Quanto si asciugano le strade dopo la pioggia (per secondo reale)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Meteo")
	float VelocitaAsciugatura = 0.01f;

	// Oggetti del livello da comandare (li collega lo script mrw_crea_livello.py)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Collegamenti")
	TObjectPtr<ADirectionalLight> SoleLuce;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Collegamenti")
	TObjectPtr<AExponentialHeightFog> NebbiaAttore;

	// Parametri globali per i materiali: Notte, Pioggia, Bagnato
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Collegamenti")
	TObjectPtr<UMaterialParameterCollection> ParametriMeteo;

	// Valori calcolati (si possono leggere dai Blueprint e dall'interfaccia)
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stato")
	float Notte = 0.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Stato")
	float Bagnato = 0.0f;

protected:
	virtual void BeginPlay() override;

	// Nell'editor: quando cambi l'ora o il meteo si vede subito il risultato
	virtual void OnConstruction(const FTransform& Transform) override;

private:
	void Aggiorna(float DeltaSeconds);

	float DensitaNebbiaIniziale = 0.02f;
};
