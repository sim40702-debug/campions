// La moto del giocatore: fisica, comandi e telecamere.
//
// Fisica "a una traccia" fatta a mano (non il veicolo Chaos a 4 ruote, che per le moto non va bene):
// - motore con potenza massima e cambio automatico a 6 marce
// - freno anteriore e posteriore separati, con trasferimento di carico
// - aderenza: asfalto asciutto, asfalto bagnato (dal meteo), fuori strada
// - piega calcolata dalla fisica (la piega serve per girare: tan(piega) = v^2 / (g * raggio))
// - impennata e stoppie calcolate con il momento attorno alla ruota (baricentro, accelerazione, gravita')
// - caduta se si chiede piu' aderenza di quella che c'e' (frenata in piega, troppa piega, impennata oltre il punto di equilibrio)
// - salti: se le ruote non toccano, la moto vola e ricade
//
// La moto si vede per ora con forme semplici di Unreal (cilindri e cubi): il modello 3D vero
// arriva nella fase 3, quando c'e' un modello con i diritti d'uso verificati.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "InputCoreTypes.h"
#include "MRWMoto.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UInputAction;
class UInputMappingContext;
class AMRWTerreno;
class AMRWCicloGiorno;

UCLASS()
class MOTORACINGWORLD_API AMRWMoto : public APawn
{
	GENERATED_BODY()

public:
	AMRWMoto();

	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

	// --- Dati della moto (si possono cambiare nell'editor) ---

	// Massa di moto + pilota (kg)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float Massa = 230.0f;

	// Potenza massima (kW). Supermotard 690: circa 55 kW
	UPROPERTY(EditAnywhere, Category = "Moto")
	float PotenzaKW = 55.0f;

	// Forza massima alla ruota in prima marcia (N)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float ForzaMassimaRuota = 3300.0f;

	// Distanza tra le ruote (m)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float Interasse = 1.48f;

	// Baricentro: distanza dietro (dalla ruota posteriore) e altezza da terra (m)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float BaricentroDietro = 0.64f;

	UPROPERTY(EditAnywhere, Category = "Moto")
	float BaricentroAltezza = 0.68f;

	// Raggio delle ruote (m)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float RaggioRuota = 0.31f;

	// Aderenza delle gomme sull'asfalto asciutto (1.1 = buone gomme stradali)
	UPROPERTY(EditAnywhere, Category = "Moto")
	float AderenzaAsfalto = 1.1f;

	// Modello 3D della moto (cartella in Content con i pezzi SM450_Telaio, SM450_Sterzo...).
	// Se non c'e', la moto resta fatta di forme semplici.
	UPROPERTY(EditAnywhere, Category = "Moto")
	FString CartellaModello = TEXT("/Game/MRW/Moto/SM450");

	// Correzione della rotazione del modello importato (se in Unreal risulta girato)
	UPROPERTY(EditAnywhere, Category = "Moto")
	FRotator CorrezioneModello = FRotator::ZeroRotator;

	// Dove parte la moto (cm, X = est, Y = sud dal centro dell'area). Default: Locarno, Piazza Grande
	UPROPERTY(EditAnywhere, Category = "Moto")
	FVector PuntoPartenza = FVector(78400.0f, 194400.0f, 0.0f);

	// --- Stato (letto dall'interfaccia) ---
	float GetVelocitaKmh() const { return Velocita * 3.6f; }
	int32 GetMarcia() const { return Marcia; }
	float GetGiri() const { return Giri; }
	float GetPiega() const { return Piega; }
	float GetImpennata() const { return Beccheggio; }
	float GetDerapata() const { return Derapata; }
	bool IsCaduta() const { return TempoCaduta > 0.0f; }
	bool IsSuStrada() const { return bSuStrada; }
	bool IsPronta() const { return bPosizionata; }
	bool IsControlloImpennata() const { return bControlloImpennata; }
	FString GetMessaggio() const { return (TempoMessaggio > 0.0f || IsCaduta()) ? Messaggio : FString(); }

protected:
	virtual void BeginPlay() override;

private:
	// Pezzi della moto
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Radice;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> PernoPiega;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> PernoImpennata;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> MozzoAnteriore;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> MozzoPosteriore;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Sterzo;
	UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> Braccio;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> CameraTerza;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> CameraPrima;

	UStaticMeshComponent* AggiungiPezzo(const TCHAR* Nome, USceneComponent* Padre, UStaticMesh* Forma,
		FVector Posizione, FVector Misura, FRotator Rotazione = FRotator::ZeroRotator);
	void ColoraPezzi();
	bool UsaModello3D();

	// Comandi (creati dal codice, non servono file nell'editor)
	void CreaComandi();
	UInputAction* NuovaAzione(const TCHAR* Nome);
	void Mappa(UInputAction* Azione, FKey Tasto, bool bNegativo = false);

	UPROPERTY() TObjectPtr<UInputMappingContext> Contesto;
	UPROPERTY() TObjectPtr<UInputAction> AzioneGas;
	UPROPERTY() TObjectPtr<UInputAction> AzioneFrenoAnteriore;
	UPROPERTY() TObjectPtr<UInputAction> AzioneFrenoPosteriore;
	UPROPERTY() TObjectPtr<UInputAction> AzioneSterzo;
	UPROPERTY() TObjectPtr<UInputAction> AzionePeso;
	UPROPERTY() TObjectPtr<UInputAction> AzioneCamera;
	UPROPERTY() TObjectPtr<UInputAction> AzioneRiparti;
	UPROPERTY() TObjectPtr<UInputAction> AzioneAiuto;
	UPROPERTY() TObjectPtr<UInputAction> AzioneOra;
	UPROPERTY() TObjectPtr<UInputAction> AzionePioggia;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> AzioniPreset;

	void CambiaCamera();
	void Riparti();
	void CambiaAiuto();
	void AvantiUnOra();
	void CambiaPioggia();
	void ScegliPreset(int32 Livello);
	void PresetLow() { ScegliPreset(0); }
	void PresetMedium() { ScegliPreset(1); }
	void PresetHigh() { ScegliPreset(2); }
	void PresetUltra() { ScegliPreset(3); }
	void PresetCinematic() { ScegliPreset(4); }
	void Mostra(const FString& Testo);

	// Fisica
	void Fisica(float Dt);
	bool TrovaSuolo(const FVector& Punto, float Sopra, float Sotto, FHitResult& Colpo) const;
	void Cadi(const FString& Motivo);
	void AggiornaPilotaInVolo(float Dt);
	void RimettiPilota();
	void Posiziona(const FVector& Punto, const FVector& Direzione);
	void AggiornaGrafica(float Dt);
	float LeggiValore(UInputAction* Azione) const;

	UPROPERTY() TObjectPtr<AMRWTerreno> Terreno;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> PilotaModello;
	UPROPERTY() TObjectPtr<AMRWCicloGiorno> Meteo;

	// Comandi letti ad ogni frame
	float Gas = 0.0f;
	float FrenoAnteriore = 0.0f;
	float FrenoPosteriore = 0.0f;
	float SterzoComando = 0.0f;
	float PesoIndietro = 0.0f;

	// Stato della moto
	float Velocita = 0.0f;        // m/s in avanti
	float VelocitaVerticale = 0.0f; // m/s (salti)
	float Imbardata = 0.0f;       // gradi (direzione)
	float Piega = 0.0f;           // gradi (+ = a destra)
	float Beccheggio = 0.0f;      // gradi (+ = impennata, - = stoppie)
	float VelocitaBeccheggio = 0.0f; // gradi/s
	float Derapata = 0.0f;        // gradi: di quanto il dietro esce in derapata
	float Slittamento = 0.0f;     // oltre 1.5 la gomma perde aderenza e si cade
	float Affondamento = 0.0f;    // gradi: forcella che affonda in frenata (-) o dietro schiacciato (+)
	FVector VoloPilota = FVector::ZeroVector;   // velocita' del pilota caduto (cm/s)
	FRotator GiroPilota = FRotator::ZeroRotator; // capriola del pilota caduto (gradi/s)
	float PendenzaSuolo = 0.0f;   // gradi
	float Giri = 1200.0f;
	int32 Marcia = 1;
	float AngoloRuote = 0.0f;
	bool bAppoggiata = true;
	bool bSuStrada = true;
	bool bPosizionata = false;
	bool bPrimaPersona = false;
	bool bControlloImpennata = true;
	float TempoCaduta = 0.0f;
	float TempoPuntoSicuro = 0.0f;
	FVector PuntoSicuro = FVector::ZeroVector;
	FVector DirezioneSicura = FVector::ForwardVector;
	float TempoDaPartenza = 0.0f;
	FString Messaggio;
	float TempoMessaggio = 0.0f;
};
